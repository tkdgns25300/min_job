# CLAUDE.md — MinJob

> **이 파일은 HOW** — 아키텍처·데이터 수집 파이프라인·코드 컨벤션·가드레일. 페이지 기능은 [`docs/SPEC.md`](./docs/SPEC.md), 데이터 모델·테이블은 [`docs/DATA.md`](./docs/DATA.md)(작성 예정), 작업은 [`docs/ROADMAP.md`](./docs/ROADMAP.md), 환경·재개는 `README.md`(예정), 시점 핸드오프는 `docs/SNAPSHOT.md`(예정).
>
> **문서 책임 분리** — 같은 사실을 두 곳에 쓰지 않는다. 아키텍처·컨벤션·가드레일은 여기, 페이지 명세는 SPEC, 데이터는 DATA, 작업은 ROADMAP.

## Project

흩어진 **부교역자(부목사·전도사) 청빙 공고**를 한 곳에 모아, 구조화된 정보로 검색·비교하게 해주는 채용 플랫폼. 여러 신학교·교단 게시판에 분산된 공고를 사람이 수집하고 AI로 구조화해 노출한다. 타겟 교단: 예장합동·예장통합. **단순 "모아보기"를 넘어 구조화·비교·신뢰정보(재공고 추적)로 차별화한다.** 1인 개발자(백엔드) 사이드 프로젝트, 운영 리소스 최소화가 핵심 제약.

**Stack**: Next.js 16 (App Router, Cache Components) · React 19 · TypeScript strict · Tailwind v4 + shadcn/ui (Base UI) · Supabase (PostgreSQL + Auth) · Vercel · npm

> ⚠️ **Next.js 16 / React 19 / Cache Components**: 학습 데이터와 다를 수 있음. 코드 작성·수정 전 공식 문서를 먼저 확인할 것 (특히 `'use cache'`, `cacheTag`, `cacheLife`, `updateTag`, `revalidateTag`).

## Architecture Overview

### 핵심 결정: DB 기반 동적 사이트 (공고 CRUD + 검색 + 소유권 인수)

순수 SSG와 달리 MinJob은 공고 등록·검색·소유권 인수(claim)가 있어 **DB와 mutation이 필요**하다. 단 공고는 변경 빈도가 낮고 모든 방문자가 같은 목록을 보므로, **`'use cache'` + 태그 무효화** 패턴을 채택한다. 공고 상세는 빌드타임 prerender(`generateStaticParams`) 하지 않고 **on-demand `'use cache'`로 첫 요청 시 캐시**한다 (공고가 배포 후 계속 추가되므로).

```
[브라우저]
   │
   ▼
[Vercel Edge CDN]  ← 공고 목록·상세는 'use cache' 결과 직접 서빙
   │ ↓ MISS
   ▼
[Vercel 함수 (Node.js)]  ← 'use cache' 실행, mutation(등록·claim), 검색
   │
   ▼
[Supabase Seoul]
```

| 페이지 | 모드 | 이유 |
|---|---|---|
| `/`, `/jobs`, `/jobs/[id]`, `/churches/[id]` | `'use cache'` (CDN 캐시, on-demand) | 공고 변경 빈도 낮음, 모든 방문자 동일 뷰 |
| `/jobs?(검색·필터 쿼리)` | dynamic (`<Suspense>`) | searchParams 의존 — 매번 fresh |
| `/admin/**` | dynamic | 운영자 전용 등록·관리 도구 |
| `/login`, `/mypage` | dynamic | 인증 의존 |

### 데이터 수집·구조화 파이프라인 (MinJob 고유 — 반드시 준수)

공고 데이터는 **"사람이 수집 → AI가 구조화 → 운영자가 admin으로 등록"** 흐름으로만 채운다.

```
[사람이 공개 공식 게시판에서 공고 텍스트를 직접 선별·확보]
        │  (한 건 한 건 사람 판단 개입 — 자동 크롤러 아님)
        ▼
[AI 구조화 — 자유 텍스트 → 필드(교단·지역·사례비·부서 등)]
        │  (반자동 입력 도구: 텍스트 붙여넣으면 폼 자동 채움)
        ▼
[운영자가 검토 후 admin 등록 — '운영자 등록', 소유자 없음]
        │
        ▼
[나중에 교회가 가입 → claim → 소유권 연결 → 자생 운영 전환]
```

- **수집(input)은 사람이, 구조화(processing)는 AI가.** 이 경계는 법적 안전선이다 (가드레일 참조).
- AI 구조화는 자유롭게 자동화해도 된다. 문제는 입력을 어디서 가져오느냐다.

### SEO는 성장 엔진 (필수)

검색 유입("OO지역 전도사 청빙", "유초등부 전도사 모집")이 트래픽의 핵심. 기존 청빙 사이트들이 구식이라 SEO가 약해 비집고 들어갈 틈이 크다. 모든 페이지는:

- `generateMetadata`로 title·description·Open Graph 설정
- 공고 상세 = schema.org **`JobPosting`** JSON-LD (title·hiringOrganization·jobLocation·datePosted·employmentType 등)
- `app/sitemap.ts`·`app/robots.ts`로 sitemap·robots 생성, `<html lang="ko">`
- 구조화된 공고 데이터를 검색엔진이 읽기 좋은 형태로 출력

## Directory

```
src/
├── app/
│   ├── (public)/                  비로그인 접근 가능 영역
│   │   ├── layout.tsx             공개 shell
│   │   ├── page.tsx               홈 — 최신·추천 공고 ('use cache')
│   │   ├── jobs/
│   │   │   ├── page.tsx           공고 목록 + 검색·필터 (목록 cache, 검색은 Suspense)
│   │   │   ├── [id]/page.tsx      공고 상세 (generateMetadata + JobPosting JSON-LD)
│   │   │   └── *-view.tsx         목록·필터 client component
│   │   └── churches/[id]/page.tsx 교회 상세 (그 교회 공고 + 재공고 이력)
│   ├── (authed)/                  로그인 필요 영역 (proxy 인증 게이트)
│   │   ├── mypage/                구직자/교회 마이페이지
│   │   ├── jobs/new/              교회 공고 등록 폼 + actions.ts
│   │   └── claim/                 소유권 인수 + actions.ts
│   ├── admin/                     운영자 전용 — 수집 공고 등록·구조화 도구
│   │   ├── jobs/                  공고 admin CRUD + actions.ts
│   │   └── ingest/                텍스트 붙여넣기 → AI 구조화 → 폼 자동 채움
│   ├── login/                     Supabase Auth 로그인
│   ├── sitemap.ts · robots.ts     SEO
│   └── layout.tsx                 root layout (폰트·메타·GA)
├── components/
│   ├── layout/                    헤더·푸터·네비
│   ├── job/                       공고 카드·필터바·재공고 배지
│   ├── church/                    교회 카드
│   └── ui/                        shadcn 원본
├── constants/                     도메인 enum (교단·지역·부서·고용형태) — 영어 key + 한글 라벨
├── lib/
│   ├── supabase/
│   │   ├── server.ts              쿠키 기반 — 인증·mutation 전용
│   │   ├── service.ts             service-role — cached read 전용
│   │   └── session.ts             proxy 세션 refresh용
│   ├── queries/                   'use cache' 페이지가 호출하는 read 함수 (도메인 1개당 1파일)
│   ├── ingest/                    AI 구조화 파이프라인 (텍스트 → 필드)
│   ├── repost-tracking.ts         재공고 식별·집계 (단일 정의)
│   ├── seo.ts                     JSON-LD·메타 헬퍼
│   └── utils.ts                   cn 등
├── types/                         database.ts (Supabase 생성), domain.ts
└── proxy.ts                       Next.js 16 Proxy — (authed)/admin 인증 게이트

supabase/migrations/               DB 마이그레이션 SQL
```

> ⚠️ 위 트리는 **목표 구조 예측**이다 (코드 작성 전). 개발하며 드리프트할 수 있으니 "계약"으로 신뢰하지 말 것.

## Layer Responsibilities

### Page (`app/**/page.tsx`)
- **조합만** 한다. 로직·데이터 fetching·집계 안 한다.
- `'use cache'` 페이지: `cacheTag(...)` + `cacheLife(...)` 후 query 함수 호출 → view에 prop 전달
- dynamic 페이지(검색·admin·authed): `<Suspense>`로 data 컴포넌트 감싸기
- 동적 segment(`[id]`)는 `generateMetadata` + JSON-LD. 빌드타임 prerender 안 함 — on-demand `'use cache'`로 캐시

### Server Action (`app/**/actions.ts`)
- `"use server"` 디렉티브. 모든 mutation(공고 등록·수정·claim·삭제)은 여기서.
- `createClient()` (server.ts, 쿠키 기반)으로 인증 보장된 호출
- 끝에서 `updateTag(resource)` — read-your-own-writes
- REST API 라우트 만들지 않는다.

### Query (`lib/queries/*.ts`)
- `'use cache'` 페이지가 호출하는 read 전용 함수
- `createServiceClient()` (service.ts, 쿠키 X)
- fetch + transform + return. 집계·재공고 계산 등 비즈니스 로직은 여기
- **쿠키·헤더 절대 만지지 마라** — cached scope 안에서 호출됨

### Ingest (`lib/ingest/*.ts`)
- 사람이 확보한 공고 텍스트를 받아 AI로 구조화하는 함수. admin 등록 도구가 호출.
- 입력은 항상 "사람이 붙여넣은 텍스트"다. 외부 사이트를 자동으로 가져오는 코드를 여기 두지 않는다 (가드레일).

### View (`app/**/*-view.tsx`)
- `"use client"`. 인터랙티브 UI(필터·검색·폼)만. prop으로 데이터 받음, 직접 fetch X.

### Component (`components/**`)
- 도메인 로직 없음. 재사용 UI만. `ui/` = shadcn 원본.

## Supabase Client 사용 규칙

DB 접근은 아래 3개 파일로만. 새 클라이언트 만들지 말 것. 브라우저 클라이언트(`createBrowserClient`) 절대 X.

| 파일 | 키 | 쿠키 | 사용처 |
|---|---|---|---|
| `lib/supabase/server.ts` | anon | ✅ (세션) | `actions.ts`(모든 mutation), dynamic 페이지 |
| `lib/supabase/service.ts` | service-role | ❌ | `lib/queries/*.ts`(cached read만) |
| `lib/supabase/session.ts` | anon | ✅ | `proxy.ts` 세션 refresh용 (단독 사용 X) |

`service.ts`가 RLS를 우회하므로 cached read(공개 공고 조회) 전용으로만. 인증·권한이 필요한 작업은 반드시 `server.ts`.

## `'use cache'` 제약 (필수 준수)

cacheComponents 활성(`next.config.ts`). 어기면 빌드 실패·캐시 깨짐:

1. **cached scope 안에서 `cookies()`/`headers()`/`searchParams` 절대 호출 X** — 검색·필터는 dynamic 페이지로
2. **`new Date()` 등 비결정적 값은 인자로 전달** (캐시 시점에 frozen)
3. **dynamic 데이터는 `<Suspense>`로 감싸기**
4. **공고 상세는 on-demand `'use cache'`로 캐시** (빌드타임 prerender X). datePosted 등 시간 표시는 클라이언트에서 계산

## DB Policy

- **DB는 데이터 저장 전용**. DB trigger·custom function·복잡한 default expression 만들지 않는다. ID 발급·timestamp 갱신·집계·재공고 판정 등 모든 비즈니스 로직은 Server Action / query 함수에서.
- 내장 기능(`gen_random_uuid()`, sequence `nextval()`, CHECK, FK)만 사용.

## 가드레일 (MinJob 고유 — 절대 위반 금지)

법적·정책적 이유로 정한 원칙. 코드 작성 시 반드시 준수한다. 근거는 DATA.md.

1. **자동 크롤러 구현 금지.** 외부 사이트를 프로그램이 주기적·대량으로 수집하는 코드를 만들지 않는다. "사실 정보만"이어도 금지 — DB권·부정경쟁방지법 위반 소지(잡코리아 vs 사람인 판례). 공고 수집은 사람이 한 건씩 한다. AI 구조화는 "사람이 붙여넣은 텍스트"에만 적용한다.
2. **공고 소유자(owner)는 nullable.** 공고는 교회 계정에 필수 종속되지 않는다. 운영자 등록 공고는 소유자 없이('운영자 등록') 저장한다. 교회는 나중에 claim으로 연결한다. 공고를 user의 자식으로 강결합하지 않는다.
3. **개인정보(연락처) 취급 주의.** 운영자 수집 공고에 개인 담당자 연락처를 임의로 저장·노출하지 않는다. 교회 대표 공개 연락처만, 또는 "원문 보기" 링크로 안내. 개인 정보는 교회가 claim 후 직접 입력하게 한다.
4. **영리 청빙 사이트(청빙넷 등)를 출처로 삼지 않는다.** 사람이 수집하더라도 공공·교단·신학교 공식 게시판을 우선한다.

## Clean Code Principles

- **단일 책임**: 한 함수/컴포넌트는 한 가지. 60줄 넘으면 분해 검토.
- **명명이 곧 문서**: 의도가 드러나는 이름. 주석은 *왜*가 필요할 때만.
- **죽은 코드 즉시 삭제**: 미사용 import/변수/함수 남기지 않음.
- **매직 값 금지**: 숫자/문자 리터럴은 `constants/`에. 교단·지역·부서 같은 도메인 값도.
- **에러는 경계에서만**: 사용자 입력·외부 API 경계에서만 처리.
- **타입으로 잘못된 상태를 표현 불가능하게**: `any` 금지. union/literal로 좁힌다.
- **추상화는 3번째에**: 한두 번 비슷한 코드는 그대로. 패턴이 굳으면 추출.

## Code Conventions

**Naming**
- 파일/폴더: `kebab-case`. 데이터·이미지·라우트 id는 **영어 kebab-case**만 (한글 금지 — URL 인코딩 문제 방지).
- 컴포넌트/타입: `PascalCase` (`JobCard`, `Job`) — `I` prefix 금지
- 함수/변수: `camelCase` (`getActiveJobs`)
- 상수: `UPPER_SNAKE_CASE` (`DENOMINATIONS`, `MIN_STIPEND`)
- Boolean: `is`/`has`/`should` 접두사
- **도메인 enum**: 값은 **영어 대문자 key**(`SEOUL`, `HAPDONG`)로 저장·URL params에 사용, 화면 표시는 `constants/`의 **한글 라벨 맵**(`{ SEOUL: '서울' }`). 한글을 저장값·URL에 쓰지 않는다. (허용값 목록은 DATA.md)

**TypeScript**
- `any` 금지. 불가피하면 `unknown` + 타입 가드.
- 공유 타입은 `types/domain.ts` 또는 `lib/queries/*.ts`(쿼리 반환 타입). 한 파일 전용 타입은 파일 상단.

**Styling**
- Tailwind 인라인. 별도 CSS 파일 X (`globals.css` 제외).
- shadcn/ui 우선. **모바일 퍼스트** (`base` → `sm` → `md` → `lg`) — 구직 교역자가 폰으로 공고를 본다. (디자인 방향은 SPEC.)

**Imports**
- 항상 `@/` alias. 상대 경로는 같은 폴더 내에서만.

## Git Workflow

- 브랜치: `prod`(배포·안정) / `dev`(개발·작업). 평소 작업은 항상 `dev`. feature 브랜치 X.
- 릴리스는 `dev` → `prod` **fast-forward only** (merge 커밋 만들지 않는다).
- **commit / push / merge는 사용자가 명시적으로 요청할 때만.** 자동 커밋 금지.
- 커밋 메시지: 영어, 동사 원형(Add/Fix/Update/Remove). 1 커밋 = 1 논리적 변경.

## 소통

- 사용자와의 대화는 **한국어**. 커밋 메시지·코드 식별자(변수·함수·파일명)는 **영어**.
- **코드 주석은 한국어 허용** — 도메인(한국 교단 청빙) 맥락 설명이 많아 한국어가 더 명확. 식별자·커밋은 계속 영어.

## Quality Checklist

코드 작성 후 확인:
1. `npm run build` 통과 (TypeScript + Cache Components 검증)
2. 미사용 import/변수 없음 · `any` 없음 · 단일 책임
3. 네이밍만으로 역할 이해 가능
4. **새 페이지**: cache 페이지는 `'use cache'` + `cacheTag` + `cacheLife`, 검색·인증 페이지는 `<Suspense>`/dynamic. 상세는 `generateMetadata` + JobPosting JSON-LD + sitemap 반영
5. **새 mutation**: actions.ts 끝에서 `updateTag(resource)`, 영향 태그 모두 invalidate
6. **DB 접근**: `lib/supabase/{server,service}.ts` 중 적절한 것. 새 클라이언트 X
7. **가드레일 준수**: 자동 크롤러 없음 · 공고 owner nullable · 연락처 임의 저장 없음 · 영리 사이트 출처 아님
8. **cached scope**: cookies/headers/searchParams 안 만짐, 비결정적 값은 인자로
