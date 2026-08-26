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
| `/admin/jobs` | `'use cache'` (non-PII read) | 목록은 공개·비개인 데이터(공고 집계) — 모든 운영자 동일 뷰. 공개 헤더를 안 써서 ○ Static 유지. **접근 판정은 proxy가 담당** |
| `/admin` | dynamic (`<Suspense>` + `requireOperator`) | 홈이 그리는 다섯 수치 중 넷이 캐시 불가(검수·인증 큐는 판정하면 바뀌고 `crawl_run`은 크롤러가 밖에서 쓴다) → `◐`. 셸은 계속 프리렌더되고, dynamic이 된 덕에 **페이지에서도 게이트를 확인**한다 |
| `/admin/jobs/[id]` | dynamic (`<Suspense>` + `requireOperator`) | 공개 공고 편집 — 쓰기 화면이라 게이트를 페이지에서도 확인한다. 값은 캐시된 seam(`getJobForEdit`)에서 오고 저장 액션이 `updateTag("jobs")`로 비운다 |
| `/admin/review/**` | dynamic (`<Suspense>` + `requireOperator`) | **미검수 크롤 데이터**(`review_data`) — 캐시 금지(판정하는 순간 바뀐다). 포스터는 Storage signed URL이라 만료가 있어 요청마다 만든다 |
| `/admin/verify`, `/admin/verify/[id]` | dynamic (`<Suspense>` + `requireOperator`) | 인증 신청 PII(담당자 실명·직분·이메일 + 증빙 서류) — 캐시 금지 + 페이지에서도 운영자 재확인. 판정 화면은 서류 signed URL이 30분 만료라 요청마다 만든다 |
| `sitemap.xml` | **dynamic (`ƒ`) — 의도적** | 순수 정적 렌더에서는 Supabase 클라이언트의 인증 경로가 부르는 `Date.now()`가 금지돼, 캐시 무효화 뒤 **가장 먼저 재생성될 때 500 + 빈 sitemap**이 나간다(실측 2026-08-22). `connection()`으로 dynamic을 선언해 그 금지를 벗는다 — **데이터는 계속 `'use cache'`에서** 오고 요청마다 하는 일은 XML 조립뿐이다 |
| `/login` | dynamic (`<Suspense>`) | `?next=`·`?error=` 의존. 폼은 **서버 렌더**(JS 없이도 제출 동작) |
| `/mypage` 등 `(authed)` | dynamic (`<Suspense>` + `requireUser`) | 인증 의존 |

> 검수 브릿지 = **`/admin/review`**(화면 3개: 큐 목록 · 단건 검수 · 묶음 판정). `review_data`의 `PENDING`만 소비하고 **`jobs`·`source_data`는 건드리지 않는다**. 미검수·크롤링 데이터 + 운영자 게이트라 **dynamic**. 명세는 SPEC, 판정 규칙 정본은 `../min_job_agent/docs/SPEC.md`.

### 데이터 수집·구조화 파이프라인 (MinJob 고유 — 반드시 준수)

공고 데이터는 **"크롤러(공개 공식 게시판) → AI가 구조화 → 리뷰 큐 → 크롤러가 공개(APPROVED) / 운영자가 검수(PENDING)"** 와 **"인증 교회가 직접 등록"** 두 경로로 채운다.

⚠️ **수집원은 둘이다(개정 2026-08-21)** — ~~사람이 공개 게시판 글을 붙여넣는 경로(`/admin/ingest`)~~ 는 **없앴다**. 운영자가 직접 넣을 일이 없어졌고, 그 도구의 AI 구조화(`lib/ingest/structure.ts`)는 크롤러가 대신한다. (코드 삭제 2026-08-22)

```
① 크롤 경로
[크롤러(min_job_agent, 형제 리포) — 공개 공식 게시판(교단·신학교·총회) 자동 수집]
        ▼
[AI 구조화 — 자유 텍스트 → 필드(교단·지역·사례비·부서·직군 등)]
        │  (원문 재게시 X — 요약(description) + 출처 링크(source_url))
        ▼
[리뷰 큐(review_data) — 크롤러가 등급(confidence)으로 판정]
        │
        ├─ APPROVED ─▶ [크롤러가 jobs에 INSERT] ─┐  church_id=NULL · source=OPERATOR
        │  (high · 실측 77%)                      │  churches엔 쓰지 않는다
        │                                          │
        └─ PENDING ──▶ [/admin/review 운영자 검수] ┘  승인은 review_status만 바꾼다 —
           (medium·low · 17%)                          공개는 **다음 크롤 실행**이 한다
        │
        └─ REJECTED    이단·마감·중복은 크롤러가 자동 거절(2%) — 검수 큐에 오지 않는다

② 교회 경로
[교회 인증(증빙 + 운영자 승인) 통과] ─▶ [교회가 직접 등록·관리] ─▶ 바로 OPEN
                                        검수 없음 — 인증이 게이트다(2026-08-21)
```

- **수집(input)은 크롤러가(공개 공식 게시판 한정), 구조화(processing)는 AI가 한다.** 공개는 **크롤러 판정 + 사람 게이트(PENDING)** 두 갈래다(개정 2026-08-20 · 가드레일 #1 참조). 교회 행은 크롤러가 만들지 않는다 — 크롤 공고는 `church_id=NULL`이고 교회가 claim할 때 연결된다.
- ⚠️ **`jobs`에 쓰는 주체는 둘이다** — 크롤 공고는 **크롤러만**(우리 검수 화면은 `review_data`만 쓴다), 교회 공고는 우리 Server Action. 검수에서 승인해도 즉시 공개되지 않는다: 공개는 중복 판정이 끝난 뒤에만 안전해서 다음 실행이 넣는다(min_job_agent SPEC §4.3).
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
│   │   │   └── verify/            교회 인증 신청 — page(상태 3갈래) · verify-form(확인 단계) ·
│   │   │                          actions.ts(lookupChurch · 신청 접수). 판정은 운영자가 DB에서 직접
│   │   └── jobs/                  job-form·job-wizard 등 등록/수정 공용 + new/ · [id]/edit/
│   ├── admin/                     운영자 전용 — 접근 판정은 proxy(.env ADMIN_EMAILS)
│   │   ├── layout.tsx · admin-sidebar     admin shell (noindex) — jobs/ 목록만 ○ Static
│   │   ├── page.tsx(셸) · admin-status(조회·조합) · status-cards(순수) ·
│   │   │                          refresh-button · actions.ts(공개 목록 새로고침)
│   │   ├── verify/                교회 인증 — page(큐) · admin-verify-view · verification-row ·
│   │   │                          actions.ts(승인·반려) ·
│   │   │                          [id]/(판정: page · doc-view(서류·확대) · decision-panel(대조·사유·판정))
│   │   │                          (PII — 페이지에서도 requireOperator)
│   │   ├── jobs/                  공고 관리 — page(목록) · admin-jobs-view · job-row ·
│   │   │                          actions.ts(저장·마감·다시 모집) ·
│   │   │                          [id]/(편집: job-edit-form · job-value-list)
│   │   └── review/                수집 검수 — page(큐) · review-queue-view · review-row(큐 한 줄·판정 표시) ·
│   │                              actions.ts(공용) ·
│   │                              [id]/(단건: review-form(상태·판정 바·탭) · value-list(공개 상세와 같은 구획) ·
│   │                                    value-rows(키·라벨·개수 단일 소스) · value-row(줄·펼침·확인) ·
│   │                                    source-pane · poster-view · public-preview) ·
│   │                              [id]/group/(묶음: group-view·group-diff)
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
│   │                              ⚠️ admin/은 **검수·공고 관리 둘 다 쓰는 것만** — 한쪽 전용은 그 라우트 폴더에
│   ├── field.tsx                  폼 입력 한 칸(라벨·선택·필수·힌트·에러) — 5개 폼 파일 48곳 공용
│   ├── admin/value-row.tsx        값 한 줄(읽기 우선·펼쳐 고치기) + 구획 — 수집 검수·공고 관리 공용
│   ├── admin/confirm-button.tsx   되돌리기 어려운 동작에 한 번 더 묻는 버튼(그 자리에서 확인)
│   ├── admin/value-fields.tsx     두 값 화면이 같이 쓰는 칸 — 사택 3상태·연락처 4칸·금액 파서
│   ├── tab-bar.tsx                상태 탭 + 건수 배지 — 공고·검수 목록 3곳 공용(제네릭 key)
│   ├── enum-filter-select.tsx     "○○ 전체" + 도메인 라벨 맵 필터 select — admin 6곳 공용
│   └── relative-time.tsx          시간 표시(클라이언트 계산)
├── constants/                     domain.ts(도메인 enum + 그 값에 딸린 입력 안내) · business.ts(사업자정보) ·
│                                  storage.ts(localStorage 키) · site.ts(SITE_URL·SITE_OPEN_GRAPH)
├── lib/
│   ├── supabase/                  server(쿠키·인증) · service(secret·cached read, 미사용) ·
│   │                              session(proxy refresh) · cookie-options(httpOnly·secure)
│   ├── auth.ts                    순수 인증 헬퍼(hasChurchAccess·safeInternalPath·로그인 URL·PATHNAME_HEADER)
│   ├── auth-guard.ts              requireUser·requireOperator — 서버 전용 게이트(redirect 수행)
│   ├── operator.ts                운영자 판정(.env ADMIN_EMAILS) — 서버 전용
│   ├── queries/                   **데이터 seam** — jobs·churches·users·verifications·review (도메인 1파일)
│   │                              + row-map.ts(DB 행 → 도메인 타입) · fetch-all.ts(1,000행 상한 페이징)
│   │                              둘 다 queries 내부 전용
│   ├── domain-enum.ts             닫힌 라벨 맵 ↔ DB 문자열(keyOf·keysOf·enumLabel) — 캐스트를 한 곳에 가둔다
│   ├── queries/crawl.ts           마지막 수집 실행 + 실패 게시판 키 — 크롤러 소유 표를 **읽기만**(경보 판정 X)
│   ├── church-verification.ts     인증 신청 규칙(순수) — 고유번호 정규화·칸 검증·서류 제약
│   ├── review-flags.ts            검수 "확인할 것"·승격 필수 6칸 판정(순수) — 목록·필터·단건이 한 답을 쓴다
│   ├── review-edits.ts            검수가 고칠 수 있는 칸 + CHECK 짝 규칙(순수) — 화면·액션 공용
│   ├── job-edits.ts               공개된 공고를 고칠 수 있는 칸 + `jobs` CHECK 짝 규칙(순수)
│   │                              ⚠️ review-edits와 합치지 않는다 — 제약이 다르다(그 파일 머리말)
│   ├── job-visibility.ts          만료 판정 단일 소스(todayInSeoul·isPubliclyOpen·hiddenReason)
│   ├── job-church.ts              공고↔교회 파생 — church_id가 null일 수 있어 생긴 로직
│   │                              (jobChurchRef=표시값 규칙 · churchIdentityKey=교회 수 집계)
│   ├── bookmarks.ts · recent-jobs.ts · recent-searches.ts   localStorage 클라이언트 헬퍼
│   └── seo.ts · format.ts · utils.ts
├── types/                         domain.ts(공유 도메인 타입 = 화면이 쓰는 모양) ·
│                                  database.ts(**자동 생성** — DB 행의 모양. 손으로 고치지 않는다)
└── proxy.ts                       Next 16 Proxy — 세션 refresh + 접근 1차 판정(진짜 307)

supabase/migrations/               DB 마이그레이션 SQL (Supabase CLI 관례 = `YYYYMMDDHHmmss_name.sql`)
├── 20260820231650_init.sql   테이블 7개 + 제약 + 인덱스. ⬜ RLS(유예)·Storage는 다음 파일
├── 20260820234934_source_url_not_blank.sql
└── 20260821051500_drop_job_status_pending.sql   jobs.status = OPEN·CLOSED 둘뿐
```

> **⬜ = 계획만 있고 아직 없는 것.** 그 외는 2026-07-29 기준 실제 구조.
>
> **배치 규칙**: 한 페이지 전용 뷰·폼·헬퍼는 **그 페이지 폴더에** 둔다(`jobs-view.tsx`·`job-form.tsx`). **두 라우트 기능 이상**이 쓰면 `components/`로 올린다 — 한 기능 안에서 여러 페이지가 나눠 쓰는 것은 그 기능 폴더의 공용 파일로 둔다(`admin/review/review-row.tsx`를 `[id]/`가 `../review-row`로 쓴다). ⚠️ 기준은 **쓰는 파일 수가 아니라 라우트 기능 수**다 — 파일 수로 세면 한 화면 전용이 `components/`로 올라간다(실제로 그렇게 넷이 올라가 있었다 · 2026-08-24 되돌림). mutation은 그 라우트의 `actions.ts`.
> **mutation `actions.ts`는 login·mypage(로그아웃)·mypage/verify(교회 인증 신청)·admin(캐시 새로고침)·admin/review(수집 검수 판정)·admin/jobs(공개 공고 저장·마감)·admin/verify(교회 인증 판정)** — 교회의 공고 등록·수정은 아직 없다.
> ⚠️ `mypage/verify/actions.ts`의 **`lookupChurch`는 mutation이 아니다** — 클라이언트가 제출 전에 "처음인가 기존인가"를 물어야 하는데 데이터 조회용 route handler가 금지되어 있어(아래) **Server Action이 규칙이 남긴 유일한 경로**다.

## Layer Responsibilities

### Page (`app/**/page.tsx`)
- **조합만** 한다. 로직·데이터 fetching·집계 안 한다.
- **캐시는 페이지가 아니라 query 함수에 있다** — 페이지는 `lib/queries/*`를 `await` 하기만 하고, `'use cache'`+`cacheTag`+`cacheLife`는 그 query 함수 안에 붙인다. 페이지에 직접 붙이지 말 것(데이터 출처를 페이지가 몰라야 데이터 소스가 바뀔 때 페이지가 안 바뀐다 — 2026-08-22 DB 전환에서 실제로 0줄이었다)
- dynamic 페이지(검색·admin·authed): `<Suspense>`로 data 컴포넌트 감싸기
- 동적 segment(`[id]`)는 `generateMetadata` + JSON-LD. 빌드타임 prerender 안 함 — on-demand `'use cache'`로 캐시

### Server Action (`app/**/actions.ts`)
- `"use server"` 디렉티브. 모든 mutation(공고 등록·수정·삭제)은 여기서.
- `createClient()` (server.ts, 쿠키 기반)으로 인증 보장된 호출
- 끝에서 `updateTag(resource)` — read-your-own-writes
- ⚠️ **`updateTag`은 Server Action에서만 부를 수 있다**(문서 명시 — route handler·client에서는 던진다). route handler에서 무효화해야 하면 `revalidateTag`뿐이고 그건 stale-while-revalidate라 **다음 방문자가 아직 옛 데이터를 본다**. 즉시 반영이 필요하면 경로가 Server Action이어야 한다.
- ⚠️ **공고는 크롤러(별개 프로세스)가 `jobs`에 직접 쓴다** → 우리 캐시를 무효화할 방법이 없다. 그래서 공개 데이터는 `cacheLife("hours")`로 한 시간마다 스스로 갱신되고(바닥선), 즉시 반영이 필요할 때 운영자가 `/admin`의 **공개 목록 새로고침**(`refreshPublicCache`)을 누른다(가속기).
- **데이터 CRUD용 REST API 라우트 만들지 않는다.** 외부 규약이 HTTP 엔드포인트를 강제할 때만 route handler 허용 — 현재 예외 2개뿐: `app/auth/callback`(OAuth 리다이렉트 수신), `app/api/payments/complete`(결제 검증).

### Query (`lib/queries/*.ts`) — 데이터 소스 seam
- **페이지·view는 데이터를 여기서만 가져온다.** 데이터 출처를 이 레이어에 은닉한다 — 2026-08-22 mock→DB 전환에서 **페이지 코드가 0줄** 바뀌었고 라우트 모드(`◐`/`○`)도 그대로였다.
- **함수는 `async` + `'use cache'` + `cacheTag`** (read 전용). fetch + transform + return, 집계·파생 계산 등 비즈니스 로직은 여기.
- **행 → 도메인 변환은 `row-map.ts`가 한다.** enum 컬럼은 `text + CHECK`라 생성 타입이 `string`이므로 `keyOf`/`keysOf`(lib/domain-enum)로 좁힌다. ⚠️ 좁히기 실패의 기본값은 **덜 보이는 쪽**이다(`status`→`CLOSED`, `featured_tier`→`NONE`) — 모르는 값을 공개·유료 노출로 읽으면 사고가 된다.
- ⚠️ **`service.ts`는 RLS를 우회한다** → "검수 통과 교회만 공개" 같은 노출 조건은 **쿼리가 직접 걸어야** 한다(RLS가 막아 주지 않는다).
- ⚠️ **공개 노출 판정(`isPubliclyOpen`)을 SQL로 옮기지 않는다.** `lib/job-visibility.ts`가 단일 소스이고 **크롤러가 사본을 들고 있어** SQL로 한 벌 더 쓰면 사본이 셋이 된다(그래서 `jobs_visible` 뷰도 만들지 않았다). SQL은 `status='OPEN'` 같은 **확실히 탈락하는 것만 미리 거르고**(부피 줄이기), 판정은 JS가 한다.
- ⚠️⚠️ **PostgREST는 1,000행에서 자르고 에러를 주지 않는다**(실측 2026-08-22: 1,400행 중 1,000행만 오고 `count`만 1,400. `range(0,4999)`로도 안 풀린다 — 서버측 설정이다). **테이블 전체를 훑는 조회는 `fetchAllRows`(lib/queries/fetch-all.ts)로 감싼다.** 안 감싸면 공고가 1,000건을 넘는 순간 목록·통계·sitemap이 **조용히** 잘린다(목표 규모 3천 건). 페이징 조회는 **정렬 마지막 키가 유일해야** 한다(`.order("id")`) — 아니면 장 경계에서 행이 겹치거나 빠진다. 개체에 묶인 조회(교회 하나의 공고 등)는 상한에 닿을 수 없어 감싸지 않는다.
- ⚠️ **공고↔교회 embed에 `!inner`를 쓰지 않는다** — 크롤 공고는 `church_id=NULL`이 정상이라(가드레일 #1) inner join이면 통째로 탈락한다.
- **쿠키·헤더 절대 만지지 마라** — cached scope 안에서 호출됨
- **예외(인증 의존·PII read)** — `'use cache'`/`cacheTag`를 쓰지 않는 함수들:
  - `users.ts` **전체**(`getCurrentUser`·`getChurchDashboard`·`getEditableJob`) — 모두 로그인 사용자에 종속돼 방문자마다 결과가 다르다. `getCurrentUser`는 `server.ts`(쿠키 세션)를 쓰고 `React.cache`로 요청당 1회만 왕복한다 — 신원은 `auth.users`(Auth API), 소속·인증상태는 **`public.users` + `churches` 조인**에서 온다(`auth` 스키마는 PostgREST JOIN이 안 돼 프로필을 복제해 둔다).
  - `verifications.ts` — 인증 신청 PII(가드레일 #3). `server.ts`. ⚠️ **`church_verifications` 테이블은 없다** — 신청은 `users.verification_*` + `churches` 행에 나뉘어 있고 이 함수가 조인해 조립한다(DATA §3).
  - `review.ts` — **미검수 크롤 데이터**(`review_data`). 판정하는 순간 바뀌므로 캐시하면 방금 처리한 건이 큐에 남는다. 컬럼명도 여기만 snake_case를 유지한다(크롤러 소유 테이블을 직접 편집하는 도구라 명세와 1:1로 대조해야 한다).
  - `crawl.ts` — **크롤 실행 기록**(`crawl_run`). 크롤러가 우리 앱 밖에서 쓰므로 무효화할 방법이 없고, "마지막 수집이 언제인가"는 캐시된 답이 무의미한 질문이다. 같은 이유로 snake_case 유지. ⛔ **경보 판정을 옮겨오지 않는다** — 죽음(3시간)·연속 실패(2회)·빈 목록(2회)은 크롤러 `alerts_for`가 정본이고, 사본을 만들면 두 화면이 다른 말을 한다(`isPubliclyOpen`과 같은 이유). 반면 **실패한 게시판 이름과 마지막 실행 시각은 사실이라 그대로 쓴다** — 특히 "너무 오래 안 돌았나"(`CRAWL_OVERDUE_HOURS` · `constants/review.ts`)는 **크롤러가 답할 수 없는 질문**이다(프로세스가 안 뜨면 아무것도 기록하지 않는다). ⚠️ **끊긴 실행은 `finished_at`이 채워지고 `sources_ok`가 손대지 않은 게시판까지 센다** — 그대로 그리면 "전부 성공"이 되므로 `aborted`를 따로 넘긴다.
  - 이 함수들은 **dynamic 페이지의 `<Suspense>` 안·Server Action·route handler에서만** 호출한다(cached scope에서 부르면 빌드가 깨진다).

### Auth (`lib/auth.ts` · `lib/auth-guard.ts`)
- `auth.ts` = **순수 함수만**(서버 전용 import 없음): `hasChurchAccess`·`safeInternalPath`·로그인 URL 조립. `safeInternalPath`는 오픈 리다이렉트 신뢰 경계라 **서버에서만** 호출한다.
- `auth-guard.ts` = **서버 전용 게이트**(인자 없음). `requireUser()` = 미로그인이면 `redirect`. `requireOperator()` = 로그인 + `.env` `ADMIN_EMAILS` 일치까지, 아니면 `notFound`(운영자 도구 존재 은닉). 쿠키를 읽으므로 **dynamic 페이지의 `<Suspense>` 안**에서만 부른다(cacheComponents 제약).
  - **복귀 경로(`?next=`)는 `proxy.ts`가 `x-pathname` 요청 헤더로 넘겨준다** — 페이지는 자기 경로를 적지 않는다. 덕분에 **경로 지식이 `proxy.ts` 한 곳**에만 있고 쿼리스트링도 보존된다. 헤더 값은 `safeInternalPath`로 검증해 쓰고, 없으면 기본값으로 폴백한다.
- `operator.ts` = `isOperatorEmail(email)` — `.env` `ADMIN_EMAILS`(쉼표 구분) 대조. **목록이 비면 아무도 운영자가 아니다(fail-closed).**
- **2단 방어**: `proxy.ts`가 렌더 전에 진짜 307/리다이렉트로 1차 차단(비로그인 → `/login`, 운영자 아닌데 `/admin` → `/`), 페이지 게이트가 최종 판단. `(authed)` 페이지는 proxy 목록에서 빠져도 데이터가 새지 않는다.
  - ⚠️ **예외 = `/admin/jobs`(목록)** — `○ Static` 유지 목적상 페이지 게이트가 없어 **proxy가 유일한 관문**이다. 그래서 proxy는 Auth 장애로 판정이 안 될 때도 admin만은 **fail-closed**(홈으로)로 막는다. (`/admin` 홈은 2026-08-25에 dynamic이 되면서 이 예외에서 빠졌다)
  - 나머지 `/admin/*`은 **페이지에서도 `requireOperator`를 다시 부른다** — `/admin`(홈) · `/admin/verify`(PII) · `/admin/review/**`(미검수 데이터) · `/admin/jobs/[id]`(쓰기).

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
- **예외 2개 — 비공개 Storage.** `storage.objects`는 RLS가 **항상** 켜져 있고 우리 버킷엔 정책이 없어(RLS 유예) publishable 키로는 서명·업로드가 **조용히 실패**한다(실측 2026-08-22). 정책을 만들면 로그인한 아무나 파일을 읽게 되고, 운영자만 허용하려면 `.env ADMIN_EMAILS` 판정을 DB에 넣어야 해 "DB는 저장 전용"과 부딪힌다. **이 예외를 늘리지 말 것.**
  - ③ **증빙 서류 signed URL**(`lib/queries/verifications.ts`) — ①과 같은 근거·같은 모양이다(운영자 게이트 뒤의 읽기 · 30분 · 개체 하나). 버킷만 다르다.
  - ② **증빙 서류 쓰기** — 업로드(`mypage/verify/actions.ts`)는 **일반 로그인 사용자가 트리거**하고, 파기(`admin/verify/actions.ts` 반려)는 **운영자 게이트 뒤**다. 읽기(①·③)와 달리 쓰기라 방어를 코드로 만든다 — **경로에 사용자 입력을 넣지 않고**(`{user.id}/{uuid}.{ext}`) `upsert:false`로 덮어쓰기를 막으며, 크기·MIME은 버킷 설정이 한 번 더 거른다.
  - ① **포스터 signed URL**: `lib/queries/review.ts`의 포스터 signed URL은 `service.ts`를 쓴다. `storage.objects`는 RLS가 **항상** 켜져 있고 `postings` 버킷엔 정책이 없어(RLS 유예) publishable 키로는 서명이 조용히 빈 URL을 돌려준다(실측 2026-08-22). 정책을 만들면 로그인한 아무나 포스터를 읽게 되고, 운영자만 허용하려면 `.env ADMIN_EMAILS` 판정을 DB에 넣어야 해 "DB는 저장 전용"과 부딪힌다. 호출은 `requireOperator()` 뒤에서만 일어나고 나가는 것은 개체 하나에 묶인 30분 URL이다. **이 예외를 늘리지 말 것.**
- `service.ts`가 RLS를 우회하므로 cached read(공개·비개인 조회 — 공고·교회·운영자 목록 등) 전용으로만. **인증 의존·PII read(예: 교회 인증 신청)와 모든 인증·권한 작업은 반드시 `server.ts`**(cached 금지).
- ✅ **읽기는 전부 실 DB다**(2026-08-22 전환 완료 · `src/mocks/` 삭제). 쓰기는 **수집 검수 판정 · 공개 공고 저장·마감 · 교회 인증 신청 접수 · 교회 인증 판정**까지 왔다(2026-08-26). 남은 것 — 공고 등록·수정, 교회 정보 저장, 클레임은 아직 Server Action이 없다(화면만 있다).

## `'use cache'` 제약 (필수 준수)

cacheComponents 활성(`next.config.ts`). 어기면 빌드 실패·캐시 깨짐:

1. **cached scope 안에서 `cookies()`/`headers()`/`searchParams` 절대 호출 X** — 검색·필터는 dynamic 페이지로
2. **시간은 3층으로 다룬다**(DATA §6-2) — **저장**은 `timestamptz`(절대 시점) / `date`(사람이 정한 날짜), **판정**은 `todayInSeoul()`("오늘이 며칠인가"), **표시**는 `formatKstDate()`. `timestamptz`를 화면에 그대로 그리면 UTC가 나와 **날짜가 하루 어긋난다**. 시각 정렬은 문자열이 아니라 시점으로 비교한다.
3. **`new Date()`·`Math.random()` 등 비결정적 값은 캐시 엔트리가 만들어질 때 한 번 평가되고, 그 엔트리가 사는 동안 고정된다.** 금지가 아니라 **성질**이다 — 필요한 정확도와 `cacheLife` 갱신 주기를 비교해 판단한다.
   - **갱신 주기로 충분하면 cached scope 안에서 계산한다.** 예: 공고 만료 판정은 `cacheLife("hours")`라 날짜가 한 시간마다 갱신된다 — 만료가 최대 한 시간 늦게 반영되지만 공고 목록 자체가 한 시간 캐시라 무해하다.
   - **요청 시각 정확도가 필요하면** 캐시 밖에서 만들어 인자로 넘긴다. ⚠️ 단 그 **호출부가 dynamic이 되어 PPR을 잃는다** — `/jobs`·홈처럼 프리렌더되는 페이지에서는 `new Date()`가 **빌드 시각으로 굳는다**(`await connection()`으로 강제하면 `◐ PPR` → `ƒ`).
4. **dynamic 데이터는 `<Suspense>`로 감싸기**
5. **공고 상세는 빌드타임 prerender 안 함** — `generateStaticParams` 없이 `<Suspense>`로 감싼다. **데이터**는 `getJobDetail`의 `'use cache'`+`cacheTag("jobs", "job-<id>")`가 캐시하고, **페이지 셸은 요청마다 렌더**된다(셸까지 캐시하려면 별도 결정 필요). datePosted 등 시간 표시는 클라이언트에서 계산

## DB Policy

- **DB는 데이터 저장 전용**. DB trigger·custom function·복잡한 default expression 만들지 않는다. ID 발급·timestamp 갱신·집계 등 모든 비즈니스 로직은 Server Action / query 함수에서.
- 내장 기능(`gen_random_uuid()`, sequence `nextval()`, CHECK, FK)만 사용.

## 가드레일 (MinJob 고유 — 절대 위반 금지)

법적·정책적 이유로 정한 원칙. 코드 작성 시 반드시 준수한다. 근거는 DATA.md.

1. **공개 공식 게시판 한정 자동 수집·공개 허용 (사람 게이트는 PENDING에만).** ⚠️ **수집원은 크롤러와 교회 직접 등록 둘뿐이다**(개정 2026-08-21 — 사람이 게시판 글을 붙여넣는 경로는 없앴다). 크롤러(min_job_agent, 형제 리포)로 공개 공식 게시판(교단·신학교·총회)의 공고를 자동 수집한다 — 단 **원문 재게시 없이 요약(description) + 출처 링크(source_url)**, 개인정보 최소, 출처 표기, 교회 요청 시 opt-out. 수집물은 리뷰 큐(review_data)에 쌓는다. ⚠️ **거기서 갈린다(개정 2026-08-20 · 운영자 확정)**: 확인할 것이 없는 초안은 **크롤러가 `APPROVED`로 판정해 `jobs`에 직접 공개**하고, 사람이 봐야 답이 나오는 것만 `PENDING`으로 남아 운영자 검수를 거친다. 영리 청빙사이트(청빙넷 등)는 제외. 정식 오픈 전 법률 검토 완료(2026-07-28) — DB권·부정경쟁(잡코리아 vs 사람인) 리스크는 이 포지셔닝으로 방어한다. ⚠️ **그 검토는 "운영자 검수 없이는 공개 X"를 전제로 통과했다** — 바뀐 것은 "모든 건을 사람이 보나"이고 요약+출처 링크·개교회 공개게시판 한정·opt-out이라는 본체는 그대로다. 자동 공개분의 방어선은 크롤러 게이트(원문에 없는 값 비우기·이단·마감 자동 거절·애매하면 PENDING)다.
2. **공고에 작성자(user) 컬럼을 두지 않는다.** 공고는 교회(`jobs.church_id`)에 속하고, **편집 권한 = 그 교회의 인증 관리자**다. 운영자 등록 공고는 `source=OPERATOR`로만 구분한다. ~~`owner_id`~~ 는 **제거했다**(2026-08-07) — 유일한 사용처가 편집 권한 게이트였는데 그게 바로 이 가드레일 위반이었다(담당자는 여럿이고 교체된다). 공고를 user의 자식으로 강결합하지 않는다.
3. **지원용 공개 연락처는 추출·공개, 그 외 개인정보는 저장 안 함.** 공고에 지원용으로 명시 공개된 연락처는 **`jobs.contact_email`·`contact_tel`·`contact_link`·`contact_post` 4컬럼**으로 추출·공개한다(`APPLY_METHODS` 닫힌 4키와 1:1). 지원과 무관한 제3자 개인정보는 추출·저장하지 않는다. 교회가 직접 등록할 때는 본인이 연락처를 입력하게 한다.

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
- ⚠️ **Tailwind v4는 `button`에 `cursor: pointer`를 주지 않는다**(v3 preflight는 줬다). `globals.css`의 `@layer base`가 되돌려 놓았으니 버튼마다 `cursor-pointer`를 붙이지 않는다 — 붙이기 시작하면 새 버튼마다 기억해야 하고, 그래서 한때 54개가 전부 빠져 있었다.
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
7. **가드레일 준수**: 크롤링은 공개 공식 게시판 한정 · 요약+출처 링크·opt-out 준수 · 크롤 공고는 `church_id=NULL`(교회 행 생성 X) · 공고에 작성자 컬럼 없음(권한=교회 인증 관리자) · 지원용 공개 연락처만 추출(그 외 개인정보 저장 없음) · 영리 사이트 출처 아님
8. **cached scope**: cookies/headers/searchParams 안 만짐, 비결정적 값은 인자로
