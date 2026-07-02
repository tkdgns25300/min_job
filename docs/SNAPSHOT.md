# SNAPSHOT — MinJob 작업 시점 핸드오프

> **이 문서는 "지금 이 순간의 전체 컨텍스트"** — 다른 환경/시점에서 이어 작업할 때 이거 하나로 상황 파악. 역할 분리는 [`CLAUDE.md`](../CLAUDE.md)(HOW·아키텍처), [`SPEC.md`](./SPEC.md)(페이지 명세), [`ROADMAP.md`](./ROADMAP.md)(작업 단위), [`DATA.md`](./DATA.md)(데이터, 미작성).
>
> **작성 시점**: 2026-07-01 · **HEAD**: `6672c3c` (dev = prod = origin 동기화)

---

## 0. 한 문장 요약

부교역자(부목사·전도사) 청빙 공고를 모아 구조화·비교·재공고추적으로 차별화하는 채용 플랫폼. 현재 **mock 데이터로 공개 페이지를 하나씩 구현하며 스키마를 확정하는 단계**. 공개 읽기 페이지 4개 완성, 백엔드(Supabase)·인증·정적/법적 페이지·admin은 아직.

---

## 1. 지금 어디까지 왔나 (한눈에)

**완성 (mock 데이터 + 섹션 확정)**
- ✅ **홈 `/`** — 검색·스탯·추천(AD)·최신 공고
- ✅ **공고 목록 `/jobs`** — 검색·필터·정렬·페이지네이션·우측레일·모바일 Sheet
- ✅ **공고 상세 `/jobs/[id]`** — 2단(본문 플로우 + sticky 사이드바), 재공고 배지, JobPosting JSON-LD
- ✅ **교회 상세 `/churches/[id]`** — 헤더·채널·창립연도 / 현재 모집 / 재공고 이력(토글)

**스캐폴드만 (placeholder, 미구현)**
- `/pricing` `/about` `/terms` `/privacy` (정적·법적)
- `/login` `/mypage` `/jobs/new` `/jobs/[id]/edit` (인증)
- `/admin` `/admin/jobs` `/admin/ingest` (운영자)

**드롭됨**: `/churches`(교회 목록 browse) — 구직자는 공고를 검색하지 교회를 훑지 않음, `/jobs` 필터가 대체, enrichment(리뷰·연봉) 없어 값 약함.

**아직 안 함 (전부 의도적 연기)**: Supabase 연동·인증·실데이터, `'use cache'`+태그, sitemap/robots, 브랜드 그린 테마, DATA.md 작성, 배포(Vercel).

---

## 2. 실행 / 검증

```bash
npm run dev          # 로컬 개발 (http://localhost:3000)
npm run build        # 프로덕션 빌드 = TS + Cache Components 검증 (가장 중요한 게이트)
npm run lint         # eslint
npx tsc --noEmit     # 타입 체크
npm run format       # prettier --write
```

**코드 작성 후 항상**: `npm run build` + `npm run lint` 통과 확인. 상세 페이지 확인 URL:
- `/jobs/job-001`(재공고 3회 예시) · `/jobs/job-008`(재공고 2회)
- `/churches/ch-saesomang`(유초등부 재공고 3회 + 창립연도 + 채널3) · `/churches/ch-saebyeok`(이력 없음 → 이력 섹션 숨김) · `/churches/ch-juane`(SNS만) · `/churches/ch-bitsogeum`(채널 없음)

---

## 3. 기술 스택 & 핵심 아키텍처 결정

- **Next.js 16.2.9** (App Router, **Cache Components** = `cacheComponents:true`), **React 19.2**, **TypeScript strict**
- **Tailwind v4** (CSS-first `@theme`), **shadcn/ui with Base UI** (`--base base`, style base-nova), **lucide-react ^1.22** (⚠️ 브랜드 아이콘 없음 — 4번 참조)
- **Pretendard** self-host (`src/app/fonts/PretendardVariable.woff2`, `next/font/local`)
- 색: 현재 **neutral(shadcn zinc/oklch, 라이트 전용)**. 딥그린+골드 브랜드 테마는 전 페이지 공통으로 나중 적용.
- **Supabase 미연동** (`@supabase/*` 아직 설치 X — Phase 1)

**아키텍처 핵심 (CLAUDE.md 참조)**
- 공고는 변경 빈도 낮음 → 목표는 `'use cache'` + 태그 무효화. **단 지금은 mock 단계라 미적용**.
- 상세(`[id]`)는 빌드타임 prerender 안 함 → 현재는 **params 의존 동적 콘텐츠를 `<Suspense>`로 감싸 PPR**(`◐` Partial Prerender). 추후 on-demand `'use cache'` 전환.
- **레이어**: `page.tsx`=조합만 / `*-view.tsx`=프레젠테이션 뷰(**기본 서버**, 훅 필요시만 client, 인터랙션은 작은 client로 분리) / `lib/queries/*`=cached read(현재 `mocks/index.ts`가 대역) / `actions.ts`=mutation(아직 없음) / `components/**`=재사용 UI.

---

## 4. 방법론 (중요 — 계속 이렇게 진행 중)

**"페이지를 하나씩 만들며 필요한 필드를 mock JSON에 채운다 → 모든 페이지 완료 시 이 JSON이 최종 스키마 → 그걸 근거로 DATA.md 확정 → Phase 1에서 실 DB·인증."**

- mock 데이터: `src/mocks/{churches,jobs}.json` + `src/mocks/index.ts`(조회 헬퍼). 실데이터 시 `lib/queries/*.ts` + Supabase로 대체.
- 페이지마다 레퍼런스(잡코·원티드·사람인) 섹션 → 필수 섹션 → 우리 섹션 3단계로 기획하고, **확정된 페이지의 섹션은 `docs/SPEC.md`「페이지별 섹션(확정)」에 기록**.
- 인증·mutation 페이지(로그인/등록/수정/mypage/admin)는 **mock으로 만들지 않는다** — 실 백엔드 위에서 만드는 게 효율적. 정적 페이지까지만 mock, 그 뒤 DATA.md+Phase 1.

---

## 5. 데이터 모델 (현재 mock 스키마 = 확정 진행 중)

### enum (`src/constants/domain.ts`) — 영어 대문자 key(저장·URL) + 한글 라벨(표시)
| enum | 값 |
|---|---|
| `DENOMINATIONS` | HAPDONG 예장합동 · TONGHAP 예장통합 · BAEKSEOK 예장백석 · GOSIN 예장고신 · HAPSIN 예장합신 · KIJANG 기장 · GAMLI 감리교 · SEONGGYUL 성결교 · BAPTIST 침례교 · SUNBOK 순복음 · ETC 기타 |
| `REGIONS` | 18개 광역 (SEOUL 서울 … OVERSEAS 해외) |
| `POSITIONS` (직분) | ASSOCIATE_PASTOR 부목사 · EVANGELIST 전도사 · LICENSED_MINISTER 강도사 · ETC 기타 |
| `DEPARTMENTS` (부서) | INFANT 영유아부 · CHILDREN 유초등부 · YOUTH 중고등부 · YOUNG_ADULT 청년부 · DISTRICT 장년·교구 · WORSHIP 찬양·예배 · ADMIN 행정 · ETC 기타 |
| `EMPLOYMENT_TYPES` | FULL_TIME 전임 · SEMI_FULL_TIME 준전임 · PART_TIME 파트 |
| `FEATURED_TIERS` (노출) | NONE 일반 · PREMIUM 프리미엄 · HERO 대표광고 |
| `CHURCH_SIZES` | PLANT 개척(~50) · SMALL 소형(~300) · MEDIUM 중형(300~1000) · LARGE 대형(1000+) · `UNKNOWN_SIZE="UNKNOWN"`(필터용 미상 키, size=null) |
| `JOB_SOURCES` | OPERATOR 운영자 등록 · CHURCH 교회 직접 등록 |
| `CHURCH_CHANNELS` | HOMEPAGE 홈페이지 · YOUTUBE 유튜브 · INSTAGRAM 인스타그램 · FACEBOOK 페이스북 · BAND 밴드 (노출 순서 = 정의 순서) |

> **직교화 원칙**: 직분(position)·부서(department)·고용형태(employmentType)를 **분리된 축**으로. "전임전도사"·"교육전도사" 같은 혼합 라벨 만들지 않음.

### 타입 (`src/types/domain.ts`)
```ts
Church  = { id, name, denomination, region, city|null, size|null, foundedYear|null, links: ChurchLink[] }
ChurchLink = { type: ChurchChannel, url: string }
Job     = { id, churchId, title, position, department|null, employmentType,
            stipendMin|null, stipendMax|null, stipendNote|null,   // 만원 단위, note="내규에 따름" 등 비정형 보존
            status: "OPEN"|"CLOSED", featuredTier, postedAt("YYYY-MM-DD"), deadline|null,
            workDays|null, requirements: string[], preferred: string[], requiredDocs: string[],
            description|null, source: "OPERATOR"|"CHURCH", sourceUrl|null }
JobCard = 목록 카드 projection (job + church:{name,denomination,region,city,size})
JobDetail = { job, church }   // 상세 페이지용
FilterDim = denomination|region|position|department|employmentType|size
SortKey   = recent|stipend|deadline
```
`src/lib/repost-tracking.ts`:
```ts
REPOST_MIN_COUNT = 2                              // 재공고 판정(같은 자리 2회 이상)
repostKey(job) = `${churchId}:${position}:${department??"NONE"}`   // '같은 자리' 식별키
RepostInfo  = { count, previousPostedAt|null, previousDeadline|null }
RolePosting = { id, postedAt, deadline|null, status }
RoleHistory = { position, department|null, postings: RolePosting[] }   // 공고 횟수 = postings.length
getRepostInfo(job, allJobs) → RepostInfo|null
groupByRole(jobs) → RoleHistory[]   // 자리별 그룹, 반복 많은 순→최신순
```

### mock 데이터 현황
- **churches.json** — 8개 교회. 채널 다양성(홈+유튜브+인스타 / 홈만 / SNS만(인스타+밴드) / 채널 없음(빛과소금)), 창립연도(일부 null), 규모(null 포함).
- **jobs.json** — 16개 공고(job-001~016). featuredTier(HERO 2·PREMIUM 3·NONE 나머지), status(OPEN 12·CLOSED 4). **재공고 데모**: 새소망 유초등부(job-001 open + 015·016 closed = 3회), 반석 중고등부(job-008 open + 014 closed = 2회).
- **mocks/index.ts 헬퍼**: `getAdJobs` `getRecentJobs(limit)` `getAllJobCards` `getJobStats` `getJobDetail(id)` `getRepost(id)` `getChurch(id)` `getChurchOpenJobs(churchId, excludeId?)` `getChurchTimeline(churchId)`.

---

## 6. 확정 페이지 섹션 (상세는 SPEC.md「페이지별 섹션(확정)」)

**홈 `/`**: 검색(→/jobs) · 스탯(모집 중·이번 주 새 공고, 결정적 계산) · 추천 청빙(HERO AD) · 최신 공고. (제외: 개인화추천·랭킹·카테고리탐색·툴·콘텐츠)

**공고 목록 `/jobs`**: 검색 · 대표광고(AD, HERO) · 좌 필터(교단·지역·직분·부서·고용형태·**교회규모** 칩+더보기, 사례비 range, 협의 포함) · 정렬(최신·사례비·마감임박) · 리스트(프리미엄 상단) · 우측 레일(최근 본 공고·배너) · 페이지네이션(8/p) · 모바일 필터 Sheet. **mock 클라이언트 필터**(`filter-jobs.ts` 순수함수 + `JobFilter`/`Pagination`) — 실데이터 시 서버렌더(목록 cache + 필터 dynamic `?page=`)로 전환.

**공고 상세 `/jobs/[id]`** (2단, 좌 본문 플로우 + 우 sticky 사이드바, **본문 카드 없이 제목+구분선**):
- 좌: 헤더(교회·제목·직분줄·재공고 배지+직전마감) / 자격요건 / 우대사항 / 공고안내(본문) / 교회정보(+다른 모집)
- 우 사이드바: 핵심조건(사례비·마감·출근·고용형태·제출서류) / 지원안내(원문보기 or 교회홈피 CTA, **사이트 내 지원 없음**) / ★교회 채널
- 하단: 비슷한 공고(같은 부서→지역) · 출처 표기 · 오류 문의
- SEO: generateMetadata + **JobPosting JSON-LD**(`lib/seo.ts`)
- (레이아웃 "시안 A"로 결정 — 이전에 카드 7개 파편화 → 사이드바+플로우로 전환)

**교회 상세 `/churches/[id]`** (단일 컬럼, 허브라 사이드바 없음):
- 헤더: 이니셜 아바타 + 교회명 + 교단·지역·규모·**창립연도** + 채널
- 현재 모집 N건(JobCard 그리드, 빈 상태 처리)
- ★★ **공고 이력**("시안 C"): 재공고 시 요약 문장("이 교회는 OO 자리를 최근 N번 공고했어요") 항상 노출 + `<details>` 토글로 자리별 타임라인. **현재 단발 공고 제외, 반복·지난 공고 없으면 섹션 숨김.**
- SEO: generateMetadata
- **제외(전부 근거 있음)**: 교회 리뷰(명예훼손·데이터 없음 → 재공고 이력=사실로 대체) / 연봉·재무·인원 통계(소스 없음) / 복리후생·BEST문화 / 팔로우·알림(Phase2) / 커버·로고 / 유사교회. **정체성: 의도적으로 얇음, 순수 신규가치 = 재공고 타임라인 + SEO 허브. 리뷰·연봉 조작 안 함(integrity·가드레일).**

---

## 7. 파일 맵 (실제 존재)

```
src/
├── app/
│   ├── (public)/
│   │   ├── layout.tsx · page.tsx(홈)
│   │   ├── jobs/ page.tsx · jobs-view.tsx(client 필터) · filter-jobs.ts(순수) · [id]/{page.tsx, job-detail-view.tsx}
│   │   ├── churches/[id]/{page.tsx, church-detail-view.tsx}
│   │   ├── pricing · about · terms · privacy /page.tsx  ← 전부 Placeholder 스캐폴드
│   ├── (authed)/ layout.tsx · mypage · jobs/new · jobs/[id]/edit  ← 스캐폴드
│   ├── admin/ layout.tsx · page.tsx · jobs · ingest  ← 스캐폴드
│   ├── login/page.tsx  ← 스캐폴드
│   ├── layout.tsx(root, Pretendard·메타) · globals.css(neutral 토큰) · fonts/PretendardVariable.woff2
├── components/
│   ├── job/ job-card · job-filter · pagination · recently-viewed(client, localStorage read) · record-recently-viewed(client, 상세에서 기록) · job-actions(client, 저장·공유)
│   ├── church/ church-channels(공유, links→아이콘)
│   ├── layout/ header · footer · placeholder
│   └── ui/ badge · button · card · input · sheet  (shadcn Base UI 원본)
├── constants/ domain.ts(enum) · storage.ts(localStorage 키)
├── lib/ format.ts(formatStipend·churchMetaLine·churchLocation) · repost-tracking.ts · seo.ts · utils.ts(cn)
├── mocks/ churches.json · jobs.json · index.ts
└── types/ domain.ts
```
> ⚠️ `lib/supabase/*` · `lib/queries/*` · `lib/ingest/*` · `proxy.ts` · `actions.ts` · `types/database.ts` — CLAUDE 트리엔 있지만 **아직 없음**(Phase 1).

---

## 8. 확정된 설계 결정 로그 (되돌리지 말 것 / 재논의 시 근거)

- **공고 상세 = 시안 A** (2단: 본문 플로우 + sticky 사이드바). 카드-per-섹션 파편화("네모네모") 폐기.
- **교회 상세 이력 = 시안 C** (요약 문장 + `<details>` 토글). 항상 펼침(A)·재공고만+목록(B) 대신. `<details>`라 JS 없이 서버 컴포넌트 유지.
- **교회 목록 `/churches` 드롭.** 상세만 유지(공고 상세에서 진입).
- **포스터 이미지 필드 미채택.** 운영자 수집 포스터 재호스팅 = 저작권 리스크 + YAGNI. `sourceUrl`(원문 링크)로 대체. 교회 자체등록 이미지 업로드는 Phase 2 필요시.
- **교회 채널 일반화**: `homepageUrl`/`youtubeUrl` 명명 컬럼 → `links: {type, url}[]` + `CHURCH_CHANNELS` enum + 공유 `ChurchChannels`. 채널 추가 = enum만(마이그레이션 X).
- **창립연도(`foundedYear`) 추가**(nullable). 담임목사·전체주소·예배시간은 **미채택**(개인정보 경계·수집 편차·지도 Phase 2).
- **소유권 인수(claim) 기능 제거.**
- **CLAUDE View 규칙 정밀화**: `*-view.tsx` = 기본 서버 컴포넌트(과거 "무조건 use client"에서 변경). 인터랙션만 작은 client로.
- **타겟**: 예장합동/통합 거점, 목표는 한국 개신교(기독교) 교역자 청빙 전반.
- **지원 방식**: 사이트 내 지원 없음. 원문 링크 / 교회 대표 공개 채널로 안내. 개인 담당자 연락처 저장·노출 X.

---

## 9. 가드레일 (절대 위반 금지 — CLAUDE.md/DATA.md 근거)

1. **자동 크롤러 금지.** 외부 사이트 프로그램 수집 X (DB권·부정경쟁방지법, 잡코 vs 사람인 판례). 수집은 사람이 한 건씩, AI 구조화는 "사람이 붙여넣은 텍스트"에만.
2. **공고 owner nullable.** 운영자 등록(소유자 없음, `source=OPERATOR`) / 교회 직접 등록(`source=CHURCH`) 병존. user 자식으로 강결합 X.
3. **개인정보(연락처) 주의.** 담당자 개인 연락처 임의 저장·노출 X. 교회 대표 공개 채널/원문 링크로.
4. **영리 청빙 사이트(청빙넷 등) 출처 금지.** 공공·교단·신학교 공식 게시판 우선.
5. **원문 통째 복제 금지.** `description`은 운영자 요약/교회 작성.

---

## 10. Git 상태 & 워크플로우

- 브랜치: **`dev`(작업) / `prod`(배포·안정)**. feature 브랜치 X.
- 릴리스: `dev` → `prod` **fast-forward only**(merge 커밋 X): `git checkout prod && git merge --ff-only dev && git push origin prod && git checkout dev`.
- **commit/push/merge는 사용자가 명시 요청할 때만.** 커밋 메시지 영어·동사원형. 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- 원격: `github.com/tkdgns25300/min_job`. HEAD `6672c3c`, dev=prod=origin 동기화, 워킹트리 clean.
- ⚠️ **푸시 인증**: 예전에 `gh`가 다른 계정(hun-abetter)이라 push 막힌 이력 있음. 현재는 정상 push됨. 막히면 `gh auth login`으로 tkdgns25300 재인증.

**커밋 히스토리 (최신순)**: `6672c3c` 교회 상세+채널 일반화 / `e9673f4` /churches 목록 제거 / `238a048` 공고 상세 / `600d573` /jobs 목록 / `747b44c` 홈 / `e42b6da` 라우트 스캐폴드 / `b7a6042` claim 제거 / `965a461` README+Phase0.

---

## 11. 다음 작업 (효율 경로)

1. **정적·법적 페이지 배치** — `/pricing`(노출 상품 프리미엄·대표광고 2종) · `/about`(서비스 소개) · `/terms`·`/privacy`(런칭 필수). 폼 없음, 빠름. mock 방법론의 마지막 단계.
2. **DATA.md 확정** — 그동안 쌓인 mock JSON을 최종 스키마로 정리(아래 봉인 결정 7개 해결).
3. **Phase 1 백엔드 전환** — Supabase 프로젝트·클라이언트(`lib/supabase/{server,service,session}.ts`)·마이그레이션·RLS / 인증 proxy·admin 계정 / `lib/queries/*` 이관 + `'use cache'`+태그 적용 / 인증·mutation·admin 페이지를 실 백엔드 위에서 구현.

> 인증·mutation·admin 페이지는 **mock으로 만들지 않는다** — 백엔드 있어야 의미. 정적 페이지까지만 mock.

---

## 12. 연기된 것 (deferred, 결함 아님)

- `'use cache'` + `cacheTag`/`cacheLife`/`updateTag` (현재 dynamic+PPR)
- `lib/queries/*` 이관 (현재 `mocks/index.ts`가 대역)
- `app/sitemap.ts` · `app/robots.ts` (SEO 시스템 라우트)
- 계정 귀속 북마크 (현재 상세 저장버튼은 localStorage 임시. `/mypage` authed 소속, Phase 1)
- 상대시간 표시("N일 전") — 현재 절대일자(캐시 결정성)
- 브랜드 그린/골드 테마 (전 페이지 공통 나중)
- 근무지 지도 (거리 필터 Phase 2)
- Vercel 배포 (사용자 보류)

---

## 13. DATA.md 봉인 결정 (작성 시 확정할 7개)

1. 교단·지역 `jobs` 비정규화 vs `churches` join
2. position/employmentType/department 직교화 (이미 코드엔 적용)
3. enum 허용값 확정·확장 (개신교 전 교단)
4. 교회 dedup/매칭 + **재공고 추적 키** (코드: `repostKey`=churchId+position+department)
5. RLS 정책 (public/owner/service-role)
6. 노출 등급·광고 모델 (프리미엄/대표광고 2종, `featured_tier`+`featured_until`; 끌어올리기 제외·배너 Phase 2+)
7. 사례비 단위·기간 (현재 월·만원. stipend_period 결정 필요)

**기타 비개발 미해결**: 첫 거점 확정(전체 vs 집중), 신학교 커뮤니티 침투안, 데이터 수집 법률 검토.

---

## 14. 알아둘 함정 (반복해서 만난 것)

- **lucide-react ^1.22 = 브랜드 아이콘 없음** (`Youtube`/`Instagram`/`Facebook` 등 export X). 제네릭으로 매핑: 유튜브=`MonitorPlay`, 인스타=`Camera`, 페북=`Users`, 밴드=`MessageCircle`, 홈페이지=`Globe`.
- **shadcn `Card`는 `flex flex-col gap-(--card-spacing)`**(기본 gap 16px). 카드 안에서 `mt-*`/`space-y-*`를 또 주면 gap과 **합산**돼 이중 간격. → gap을 쓰거나(`gap-0`/`gap-6`로 조절) 래퍼로 묶기.
- **Cache Components**: cached scope 안에서 `cookies()/headers()/searchParams` 금지, 비결정값(`new Date()`)은 인자로. params 의존 동적 콘텐츠는 `<Suspense>`로 감싸야 빌드 통과("Uncached data outside Suspense" 에러).
- **`<details>` 토글**: `group` + `group-open:rotate-90`으로 화살표 회전(JS 없이). Tailwind v4에서 클래스 생성 확인됨.
- 롤백/외부 변경 후엔 파일 다시 Read하고 편집.

---

*이 스냅샷은 시점 기록이다. 코드·문서가 갱신되면 이 파일도 갱신하거나, CLAUDE/SPEC/ROADMAP/DATA를 정본으로 신뢰할 것.*
