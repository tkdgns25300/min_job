# CLAUDE.md — MinJob

> **이 파일은 HOW** — 아키텍처·데이터 수집 파이프라인·코드 컨벤션·가드레일. 페이지 기능은 [`docs/SPEC.md`](./docs/SPEC.md), 데이터 모델·테이블은 [`docs/DATA.md`](./docs/DATA.md), 작업은 [`docs/ROADMAP.md`](./docs/ROADMAP.md), 사용자 인터뷰·피드백은 [`docs/INTERVIEWS.md`](./docs/INTERVIEWS.md), 환경·재개는 [`README.md`](./README.md), 시점 핸드오프는 [`docs/SNAPSHOT.md`](./docs/SNAPSHOT.md).
>
> **문서 책임 분리** — 같은 사실을 두 곳에 쓰지 않는다. 아키텍처·컨벤션·가드레일은 여기, 페이지 명세는 SPEC, 데이터는 DATA, 작업은 ROADMAP.

## Project

흩어진 **개교회 채용 공고**를 한 곳에 모아, 구조화된 정보로 검색·비교하게 해주는 채용 플랫폼. 범위는 **사역직(MINISTRY, 부목사·전도사 중심, 담임목사 포함)과 일반직(GENERAL)을 아우르는 개교회 채용 허브**이되, 주력은 여전히 사역직이다. 여러 신학교·교단 게시판에 분산된 공고를 크롤러·사람이 수집하고 AI로 구조화해 노출한다. 타겟 시장은 한국 개신교(기독교) 교역자 청빙 전반(특정 교단에 한정하지 않음)이며, 초기 집중 거점은 예장합동·통합이다. **단순 "모아보기"를 넘어 구조화·비교로 차별화한다.** (신뢰정보 = 재공고 추적은 **보류** — 2026-08-07, 교회 식별을 claim으로 미루면서 판정 기반이 사라졌다. ROADMAP 1-4) 1인 개발자(백엔드) 사이드 프로젝트, 운영 리소스 최소화가 핵심 제약.

**Stack**: Next.js 16 (App Router, Cache Components) · React 19 · TypeScript strict · Tailwind v4 + shadcn/ui (Base UI) · Supabase (PostgreSQL + Auth) · Vercel · npm

> ⚠️ **Next.js 16 / React 19 / Cache Components**: 학습 데이터와 다를 수 있음. 코드 작성·수정 전 공식 문서를 먼저 확인할 것 (특히 `'use cache'`, `cacheTag`, `cacheLife`, `updateTag`, `revalidateTag`).

## Architecture Overview

### 핵심 결정: DB 기반 동적 사이트 (공고 CRUD + 검색)

순수 SSG와 달리 MinJob은 공고 등록·수정·검색이 있어 **DB와 mutation이 필요**하다. 단 공고는 변경 빈도가 낮고 모든 방문자가 같은 목록을 보므로, **`'use cache'` + 태그 무효화** 패턴을 채택한다. 공고 상세는 빌드타임 prerender(`generateStaticParams`) 하지 않고 **on-demand `'use cache'`로 첫 요청 시 캐시**한다 (공고가 배포 후 계속 추가되므로).

```
[브라우저]
   │
   ▼
[Vercel Edge CDN]  ← 공고 목록·상세는 'use cache' 결과 직접 서빙
   │ ↓ MISS
   ▼
[Vercel 함수 (Node.js)]  ← 'use cache' 실행, mutation(등록·수정), 검색
   │
   ▼
[Supabase Seoul]
```

| 페이지 | 모드 | 이유 |
|---|---|---|
| `/`, `/jobs`, `/jobs/[id]`, `/churches/[id]` | `'use cache'` 데이터 + **◐ PPR** | 공고 데이터는 캐시·모든 방문자 동일 뷰. 단 **헤더 계정 영역이 세션 의존 dynamic hole**이라 문서 응답은 `no-store`(셸은 계속 prerender·엣지 스트리밍) |
| `/jobs`의 검색·필터·정렬·페이지 | **서버는 관여 안 함** | 필터는 **100% 클라이언트 상태**(URL은 시드·반영만). 쿼리가 달라도 서버 HTML이 같아서 `/jobs`는 캐시된 전체 카드만 내려준다 → canonical도 `/jobs` 하나. ⚠️ 서버 필터링(지역·직분 랜딩 라우트)을 만들면 이 전제와 canonical을 함께 재검토 |
| `/admin`, `/admin/jobs`, `/admin/ingest` | `'use cache'` (non-PII read) | 운영자 도구지만 공개·비개인 데이터(공고·교회옵션) — 모든 운영자 동일 뷰. 공개 헤더를 안 써서 ○ Static 유지. **접근 판정은 proxy가 담당** |
| `/admin/verify` | dynamic (`<Suspense>` + `requireOperator`) | 인증 신청 PII(담당자 연락처) — 캐시 금지 + 페이지에서도 운영자 재확인 |
| `/login` | dynamic (`<Suspense>`) | `?next=`·`?error=` 의존. 폼은 **서버 렌더**(JS 없이도 제출 동작) |
| `/mypage` 등 `(authed)` | dynamic (`<Suspense>` + `requireUser`) | 인증 의존 |

> 검수 브릿지(review_data 검수 → churches/jobs 승격)용 admin 페이지는 Phase에서 추가한다 — 미검수·크롤링 데이터를 다루므로 dynamic.

### 데이터 수집·구조화 파이프라인 (MinJob 고유 — 반드시 준수)

공고 데이터는 **"크롤러(공개 공식 게시판) + 사람 붙여넣기 → AI가 구조화 → 리뷰 큐 → 운영자가 검수·승격"** 흐름으로 채운다.

```
[크롤러(min_job_agent, 형제 리포) — 공개 공식 게시판(교단·신학교·총회) 자동 수집]
   +
[사람이 공개 공식 게시판에서 공고 텍스트를 직접 선별·붙여넣기 (ingest)]
        │  (두 입력 모두 공개 공식 게시판 한정)
        ▼
[AI 구조화 — 자유 텍스트 → 필드(교단·지역·사례비·부서·직군 등)]
        │  (원문 재게시 X — 요약(description) + 출처 링크(source_url))
        ▼
[리뷰 큐(review_data) — 운영자 검수 전까지 절대 자동 공개 X]
        │
        ▼
[운영자가 검토 후 승격 → churches/jobs 등록 — '운영자 등록', 소유자 없음]
        │
        ▼
[교회는 가입 후 자기 공고를 직접 등록·관리 (운영자 등록 공고와 병존)]
```

- **수집(input)은 크롤러·사람이(공개 공식 게시판 한정), 구조화(processing)는 AI가, 공개 여부는 운영자 검수가 결정한다.** 크롤러(min_job_agent)는 운영자 보조 도구이며 **검수·승격 없이 절대 자동 공개하지 않는다** (가드레일 참조).
- AI 구조화·크롤링은 공개 공식 게시판에 한해 자동화한다. 영리 청빙사이트(청빙넷 등)는 출처에서 제외한다.

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
│   │   ├── layout.tsx             공개 shell            page.tsx  홈(최신·추천 공고)
│   │   ├── jobs/                  page(목록+필터) · [id]/(상세: generateMetadata + JobPosting JSON-LD)
│   │   │                          jobs-view(client) · filter-jobs · jobs-url-state(순수 헬퍼)
│   │   ├── churches/[id]/         교회 상세 (목록 페이지 없음 — 공고 상세에서 진입)
│   │   └── pricing/ about/ terms/ privacy/
│   ├── (authed)/                  로그인 필요 (proxy 1차 차단 + 페이지 requireUser 최종 방어)
│   │   ├── layout.tsx             인증 shell — robots noindex를 하위에 상속
│   │   ├── mypage/                사역자 view · minister-activity · account-actions · actions.ts(signOut)
│   │   │   ├── church/            교회 대시보드 + info/(정보 관리) + promote/(PortOne 노출 결제)
│   │   │   └── verify/            교회 인증 신청 (온라인 접수 미구현 — 안내 + 운영자 메일)
│   │   └── jobs/                  job-form·job-wizard 등 등록/수정 공용 + new/ · [id]/edit/
│   ├── admin/                     운영자 전용 — 접근 판정은 proxy(.env ADMIN_EMAILS)
│   │   ├── layout.tsx             admin shell (noindex) — 하위 3개는 ○ Static
│   │   └── page.tsx · jobs/ · ingest/ · verify/(PII — 페이지에서도 requireOperator)
│   ├── login/                     Google OAuth — layout(전용 미니멀 셸) · page ·
│   │                              login-form(서버) · submit-button(client) · actions.ts
│   ├── auth/callback/route.ts     OAuth 콜백(code→세션) — "REST 라우트 금지" 예외 ①
│   ├── api/payments/complete/     결제 검증(PortOne) — 예외 ②
│   ├── layout.tsx · fonts/        root layout (Pretendard self-host · 메타 · metadataBase)
│   ├── error.tsx · global-error.tsx · not-found.tsx    에러·404 바운더리
│   ├── globals.css                디자인 토큰(브랜드 색 단일 소스)
│   └── sitemap.ts · robots.ts · opengraph-image.tsx    SEO — URL은 lib/queries seam에서(DB 전환 무관)
├── components/                    ⚠️ 재사용 UI만 — 도메인 로직 X
│   ├── ui/                        shadcn 원본 (button·card·input·textarea·native-select·sheet·badge)
│   ├── layout/                    헤더(계정 영역 포함)·푸터·모바일 네비·법률문서 셸
│   ├── job/ church/ admin/ home/ pricing/ search/   각 도메인 표시 컴포넌트
│   └── relative-time.tsx          시간 표시(클라이언트 계산)
├── constants/                     domain.ts(도메인 enum) · business.ts(사업자정보) ·
│                                  storage.ts(localStorage 키) · site.ts(SITE_URL·SITE_OPEN_GRAPH)
├── lib/
│   ├── supabase/                  server(쿠키·인증) · service(secret·cached read, 미사용) ·
│   │                              session(proxy refresh) · cookie-options(httpOnly·secure)
│   ├── auth.ts                    순수 인증 헬퍼(hasChurchAccess·safeInternalPath·로그인 URL·PATHNAME_HEADER)
│   ├── auth-guard.ts              requireUser·requireOperator — 서버 전용 게이트(redirect 수행)
│   ├── operator.ts                운영자 판정(.env ADMIN_EMAILS) — 서버 전용
│   ├── queries/                   **데이터 seam** — jobs·churches·users·verifications (도메인 1파일)
│   ├── ingest/structure.ts        AI 구조화 파이프라인 (현재 키워드 휴리스틱)
│   ├── job-visibility.ts          만료 판정 단일 소스(todayInSeoul·isPubliclyOpen·hiddenReason)
│   ├── job-church.ts              공고↔교회 파생 — church_id가 null일 수 있어 생긴 로직
│   │                              (jobChurchRef=표시값 규칙 · churchIdentityKey=교회 수 집계)
│   ├── bookmarks.ts · recent-jobs.ts · recent-searches.ts   localStorage 클라이언트 헬퍼
│   └── seo.ts · format.ts · utils.ts
├── mocks/                         **현재 데이터 소스**(jobs·churches·church-verifications JSON + index.ts)
│                                  — lib/queries만 접근. DB 전환 시 이 폴더가 사라진다
├── types/domain.ts                공유 도메인 타입 (⬜ database.ts = Supabase 생성, 아직 없음)
└── proxy.ts                       Next 16 Proxy — 세션 refresh + 접근 1차 판정(진짜 307)

⬜ supabase/migrations/            DB 마이그레이션 SQL — 아직 없음(Phase 1)
```

> **⬜ = 계획만 있고 아직 없는 것.** 그 외는 2026-07-29 기준 실제 구조.
>
> **배치 규칙**: 한 페이지 전용 뷰·폼·헬퍼는 **그 페이지 폴더에** 둔다(`jobs-view.tsx`·`job-form.tsx`). 두 곳 이상에서 쓰면 `components/`로 올린다. mutation은 그 라우트의 `actions.ts`.
> **mutation `actions.ts`는 아직 login·mypage(로그아웃)뿐** — 공고 등록·수정·admin 승격은 Phase 1에서 각 라우트에 추가한다.

## Layer Responsibilities

### Page (`app/**/page.tsx`)
- **조합만** 한다. 로직·데이터 fetching·집계 안 한다.
- **캐시는 페이지가 아니라 query 함수에 있다** — 페이지는 `lib/queries/*`를 `await` 하기만 하고, `'use cache'`+`cacheTag`+`cacheLife`는 그 query 함수 안에 붙인다. 페이지에 직접 붙이지 말 것(데이터 출처를 페이지가 몰라야 mock→DB 전환 때 페이지가 안 바뀐다)
- dynamic 페이지(검색·admin·authed): `<Suspense>`로 data 컴포넌트 감싸기
- 동적 segment(`[id]`)는 `generateMetadata` + JSON-LD. 빌드타임 prerender 안 함 — on-demand `'use cache'`로 캐시

### Server Action (`app/**/actions.ts`)
- `"use server"` 디렉티브. 모든 mutation(공고 등록·수정·삭제)은 여기서.
- `createClient()` (server.ts, 쿠키 기반)으로 인증 보장된 호출
- 끝에서 `updateTag(resource)` — read-your-own-writes
- **데이터 CRUD용 REST API 라우트 만들지 않는다.** 외부 규약이 HTTP 엔드포인트를 강제할 때만 route handler 허용 — 현재 예외 2개뿐: `app/auth/callback`(OAuth 리다이렉트 수신), `app/api/payments/complete`(결제 검증).

### Query (`lib/queries/*.ts`) — 데이터 소스 seam (mock ↔ DB)
- **페이지·view는 데이터를 여기서만 가져온다.** `@/mocks` 직접 import 금지 — 데이터 출처를 이 레이어에 은닉해, mock→DB 전환 시 **페이지 코드 0 변경**.
- **함수는 `async` + `'use cache'` + `cacheTag`** (read 전용). fetch + transform + return, 집계·파생 계산 등 비즈니스 로직은 여기.
- **mock 단계**: 내부에서 `mocks/*` 위임(현재). **DB 전환**: 본문만 `createServiceClient()`(service.ts) Supabase 호출로 교체 — 시그니처·반환 타입 동일.
- **쿠키·헤더 절대 만지지 마라** — cached scope 안에서 호출됨
- **예외(인증 의존·PII read)** — `'use cache'`/`cacheTag`를 쓰지 않는 함수들:
  - `users.ts` **전체**(`getCurrentUser`·`getChurchDashboard`·`getEditableJob`) — 모두 로그인 사용자에 종속돼 방문자마다 결과가 다르다. `getCurrentUser`는 `server.ts`(쿠키 세션)를 쓰고 `React.cache`로 요청당 1회만 왕복한다.
  - `verifications.ts` — 인증 신청 PII(가드레일 #3). 현재 mock, 실배선 시 `server.ts`.
  - 이 함수들은 **dynamic 페이지의 `<Suspense>` 안·Server Action·route handler에서만** 호출한다(cached scope에서 부르면 빌드가 깨진다).

### Auth (`lib/auth.ts` · `lib/auth-guard.ts`)
- `auth.ts` = **순수 함수만**(서버 전용 import 없음): `hasChurchAccess`·`safeInternalPath`·로그인 URL 조립. `safeInternalPath`는 오픈 리다이렉트 신뢰 경계라 **서버에서만** 호출한다.
- `auth-guard.ts` = **서버 전용 게이트**(인자 없음). `requireUser()` = 미로그인이면 `redirect`. `requireOperator()` = 로그인 + `.env` `ADMIN_EMAILS` 일치까지, 아니면 `notFound`(운영자 도구 존재 은닉). 쿠키를 읽으므로 **dynamic 페이지의 `<Suspense>` 안**에서만 부른다(cacheComponents 제약).
  - **복귀 경로(`?next=`)는 `proxy.ts`가 `x-pathname` 요청 헤더로 넘겨준다** — 페이지는 자기 경로를 적지 않는다. 덕분에 **경로 지식이 `proxy.ts` 한 곳**에만 있고 쿼리스트링도 보존된다. 헤더 값은 `safeInternalPath`로 검증해 쓰고, 없으면 기본값으로 폴백한다.
- `operator.ts` = `isOperatorEmail(email)` — `.env` `ADMIN_EMAILS`(쉼표 구분) 대조. **목록이 비면 아무도 운영자가 아니다(fail-closed).**
- **2단 방어**: `proxy.ts`가 렌더 전에 진짜 307/리다이렉트로 1차 차단(비로그인 → `/login`, 운영자 아닌데 `/admin` → `/`), 페이지 게이트가 최종 판단. `(authed)` 페이지는 proxy 목록에서 빠져도 데이터가 새지 않는다.
  - ⚠️ **예외 = `/admin`·`/admin/jobs`·`/admin/ingest`** — `○ Static` 유지 목적상 페이지 게이트가 없어 **proxy가 유일한 관문**이다. 그래서 proxy는 Auth 장애로 판정이 안 될 때도 admin만은 **fail-closed**(홈으로)로 막는다.
  - `/admin/*` 중 **PII를 다루는 `/admin/verify`만** 페이지에서도 `requireOperator`를 다시 부른다(나머지 3개는 정적 유지 목적상 proxy 판정에 의존 — 실 데이터 연결 시 재검토).

### Ingest (`lib/ingest/*.ts`)
- 사람이 확보한 공고 텍스트를 받아 AI로 구조화하는 함수. admin 등록 도구가 호출.
- 입력은 항상 "사람이 붙여넣은 텍스트"다. 외부 사이트를 자동으로 가져오는 코드를 여기 두지 않는다 (가드레일).

### View (`app/**/*-view.tsx`)
- 페이지의 **프레젠테이션 뷰**. `page.tsx`는 데이터·조합만, 화면 구성은 여기로 위임.
- **기본은 서버 컴포넌트.** 훅·상태·이벤트가 필요할 때만 `"use client"`, 그 경우에도 인터랙션 단위를 **작은 client 컴포넌트로 분리**한다(예: `JobActions`) — 클라이언트 경계를 좁게.
- prop으로 데이터 받음, 직접 fetch X.

### Component (`components/**`)
- 도메인 로직 없음. 재사용 UI만. `ui/` = shadcn 원본. 데이터는 prop으로 받는다(직접 fetch X).
- **예외 1개 — `layout/header-account.tsx`**: 모든 레이아웃이 공유하는 셸이라 세션을 직접 읽는다(`lib/queries` seam 경유). 레이아웃마다 fetch+Suspense를 중복하는 대신 여기 한 곳에 둔 것 — **이 예외를 늘리지 말 것**.

## Supabase Client 사용 규칙

**접근 방식**: **Supabase 클라이언트(PostgREST) + RLS** 만 쓴다. ORM(Prisma·Drizzle)·직접 SQL(pg driver) **안 씀** — DB는 저장 전용, 로직은 Server Action/query, 보안은 RLS로 DB에 박는다(우리 규모엔 PostgREST + `'use cache'`로 충분).

DB 접근은 아래 3개 파일로만. 새 클라이언트 만들지 말 것. 브라우저 클라이언트(`createBrowserClient`) 절대 X.

| 파일 | 패키지·생성 | 키 | 쿠키 | 사용처 |
|---|---|---|---|---|
| `lib/supabase/server.ts` | `@supabase/ssr` `createServerClient` | publishable | ✅ (세션) | `actions.ts`(모든 mutation), dynamic 페이지 |
| `lib/supabase/service.ts` | `@supabase/supabase-js` `createClient` | **secret** | ❌ | `lib/queries/*.ts`(cached read만) |
| `lib/supabase/session.ts` | `@supabase/ssr` `createServerClient` | publishable | ✅ | `proxy.ts` 세션 refresh용 (단독 사용 X) |

- 키: **publishable**(구 anon, RLS 적용, `NEXT_PUBLIC_*`) / **secret**(구 service_role, RLS 우회, 서버 전용). env 이름은 README의 환경 변수 절 참조(`.env.example`은 삭제됨).
- 세션 쿠키 정책은 `lib/supabase/cookie-options.ts` 한 곳 — `httpOnly`(브라우저 클라이언트를 안 쓰므로 JS 접근 불필요) + 배포 시 `secure`. ⚠️ 로컬에서 `next start`(NODE_ENV=production)를 http로 띄우면 `secure` 때문에 로그인이 안 된다 — 로컬 로그인 테스트는 `npm run dev`로.
- `service.ts`가 RLS를 우회하므로 cached read(공개·비개인 조회 — 공고·교회·운영자 목록 등) 전용으로만. **인증 의존·PII read(예: 교회 인증 신청)와 모든 인증·권한 작업은 반드시 `server.ts`**(cached 금지).
- ⚠️ **인증만 실배선** — `getCurrentUser`(users.ts)는 Supabase Auth 실동작. 나머지 `lib/queries/*`(공고·교회·인증신청)는 아직 mock(JSON)이며 DB 전환은 쿼리 본문만 교체(시그니처 불변).

## `'use cache'` 제약 (필수 준수)

cacheComponents 활성(`next.config.ts`). 어기면 빌드 실패·캐시 깨짐:

1. **cached scope 안에서 `cookies()`/`headers()`/`searchParams` 절대 호출 X** — 검색·필터는 dynamic 페이지로
2. **`new Date()`·`Math.random()` 등 비결정적 값은 캐시 엔트리가 만들어질 때 한 번 평가되고, 그 엔트리가 사는 동안 고정된다.** 금지가 아니라 **성질**이다 — 필요한 정확도와 `cacheLife` 갱신 주기를 비교해 판단한다.
   - **갱신 주기로 충분하면 cached scope 안에서 계산한다.** 예: 공고 만료 판정은 `cacheLife("days")`라 날짜가 하루마다 갱신된다 — 만료가 최대 하루 늦게 반영되지만 공고 목록 자체가 하루 캐시라 무해하다.
   - **요청 시각 정확도가 필요하면** 캐시 밖에서 만들어 인자로 넘긴다. ⚠️ 단 그 **호출부가 dynamic이 되어 PPR을 잃는다** — `/jobs`·홈처럼 프리렌더되는 페이지에서는 `new Date()`가 **빌드 시각으로 굳는다**(`await connection()`으로 강제하면 `◐ PPR` → `ƒ`).
3. **dynamic 데이터는 `<Suspense>`로 감싸기**
4. **공고 상세는 빌드타임 prerender 안 함** — `generateStaticParams` 없이 `<Suspense>`로 감싼다. **데이터**는 `getJobDetail`의 `'use cache'`+`cacheTag("jobs", "job-<id>")`가 캐시하고, **페이지 셸은 요청마다 렌더**된다(셸까지 캐시하려면 별도 결정 필요). datePosted 등 시간 표시는 클라이언트에서 계산

## DB Policy

- **DB는 데이터 저장 전용**. DB trigger·custom function·복잡한 default expression 만들지 않는다. ID 발급·timestamp 갱신·집계 등 모든 비즈니스 로직은 Server Action / query 함수에서.
- 내장 기능(`gen_random_uuid()`, sequence `nextval()`, CHECK, FK)만 사용.

## 가드레일 (MinJob 고유 — 절대 위반 금지)

법적·정책적 이유로 정한 원칙. 코드 작성 시 반드시 준수한다. 근거는 DATA.md.

1. **공개 공식 게시판 한정 자동 수집 허용 (운영자 검수 전제).** 크롤러(min_job_agent, 형제 리포)로 공개 공식 게시판(교단·신학교·총회)의 공고를 자동 수집한다 — 단 **원문 재게시 없이 요약(description) + 출처 링크(source_url)**, 개인정보 최소, 출처 표기, 교회 요청 시 opt-out. 수집물은 리뷰 큐(review_data)에 쌓고 **운영자 검수·승격 전까지 절대 자동 공개하지 않는다** (크롤러는 운영자 보조 도구). 영리 청빙사이트(청빙넷 등)는 제외. 정식 오픈 전 법률 검토 완료(2026-07-28) — DB권·부정경쟁(잡코리아 vs 사람인) 리스크는 이 포지셔닝으로 방어한다.
2. **공고에 작성자(user) 컬럼을 두지 않는다.** 공고는 교회(`jobs.church_id`)에 속하고, **편집 권한 = 그 교회의 인증 관리자**다. 운영자 등록 공고는 `source=OPERATOR`로만 구분한다. ~~`owner_id`~~ 는 **제거했다**(2026-08-07) — 유일한 사용처가 편집 권한 게이트였는데 그게 바로 이 가드레일 위반이었다(담당자는 여럿이고 교체된다). 공고를 user의 자식으로 강결합하지 않는다.
3. **지원용 공개 연락처는 추출·공개, 그 외 개인정보는 저장 안 함.** 공고에 지원용으로 명시 공개된 연락처(전화·이메일·지원 링크)는 `jobs.contact`로 추출·공개한다. 지원과 무관한 제3자 개인정보는 추출·저장하지 않는다. 교회가 직접 등록할 때는 본인이 연락처를 입력하게 한다.
4. **영리 청빙 사이트(청빙넷 등)를 출처로 삼지 않는다.** 크롤러·사람 수집 모두 공공·교단·신학교 공식 게시판을 우선한다.

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
- 항상 `@/` alias. 상대 경로는 **같은 폴더**, 그리고 **같은 라우트 기능 폴더 안의 공용 파일**까지만 허용(예: `jobs/new/page.tsx` → `../job-form`). 그 밖으로 나가면 `@/`.

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
2. 미사용 import/변수 없음(`noUnusedLocals`·`noUnusedParameters`가 `npm run build`에서 TS6133으로 잡는다) · `any` 없음 · 단일 책임
3. 네이밍만으로 역할 이해 가능
4. **새 페이지**: 데이터는 query 함수에서 `'use cache'`+`cacheTag`+`cacheLife`(페이지엔 붙이지 않음), 인증·검색 의존은 `<Suspense>`. 상세는 `generateMetadata` + canonical + JobPosting JSON-LD(모집중만) + sitemap 반영
5. **새 mutation**: actions.ts 끝에서 `updateTag(resource)`, 영향 태그 모두 invalidate
6. **DB 접근**: `lib/supabase/{server,service}.ts` 중 적절한 것. 새 클라이언트 X
7. **가드레일 준수**: 크롤링은 공개 공식 게시판 한정 · 운영자 검수·승격 전 자동 공개 없음 · 요약+출처 링크·opt-out 준수 · 공고에 작성자 컬럼 없음(권한=교회 인증 관리자) · 지원용 공개 연락처만 추출(그 외 개인정보 저장 없음) · 영리 사이트 출처 아님
8. **cached scope**: cookies/headers/searchParams 안 만짐, 비결정적 값은 인자로
