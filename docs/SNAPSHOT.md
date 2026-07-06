# SNAPSHOT — MinJob 작업 시점 핸드오프

> **이 문서는 "지금 이 순간의 전체 컨텍스트"** — 다른 환경/시점에서 이어 작업할 때 이거 하나로 상황 파악. 역할 분리는 [`CLAUDE.md`](../CLAUDE.md)(HOW·아키텍처), [`SPEC.md`](./SPEC.md)(페이지 명세), [`ROADMAP.md`](./ROADMAP.md)(작업 단위), [`DATA.md`](./DATA.md)(데이터), [`INTERVIEWS.md`](./INTERVIEWS.md)(사용자 인터뷰).
>
> **작성 시점**: 2026-07-02 · **HEAD**: `61ea811` (dev = prod = origin 동기화) · 이 스냅샷 커밋으로 갱신

---

## 0. 한 문장 요약

교회 **사역자 청빙 공고**(부목사·전도사 중심, 담임목사 포함)를 모아 구조화·비교·재공고추적으로 차별화하는 채용 플랫폼. 현재 **mock 데이터로 공개 페이지를 구현하며 스키마를 확정하는 단계**. 공개 읽기 페이지 4개 + 정적/법적 페이지 완성, **지금은 홈을 새 디자인(딥그린+골드, 랭킹 리스트)으로 재설계 직전** — §9 참조. 백엔드(Supabase)·인증·admin은 아직.

---

## 1. 지금 어디까지 왔나 (한눈에)

**완성 (mock + 섹션 확정)**
- ✅ **홈 `/`** — 딥그린 히어로(검색+지표3) · 추천 청빙(대표광고 카드) · 2단[청빙 공고 리스트(JobRow) + 사이드바(추천검색어·교회CTA)]. 남음: 푸터(§9)
- ✅ **공고 목록 `/jobs`** — 검색·필터·정렬·페이지네이션·우측레일·모바일 Sheet
- ✅ **공고 상세 `/jobs/[id]`** — 2단(본문 플로우 + sticky 사이드바), 재공고 배지, JobPosting JSON-LD
- ✅ **교회 상세 `/churches/[id]`** — 헤더·채널·창립연도 / 현재 모집 / 재공고 이력(토글)
- ✅ **검색 오버레이** — 홈 히어로 진입 검색: 최근 검색어 + 최근 본 공고 + 검색어 완성(자동완성), IME 조합 가드. (`components/search/search-box.tsx`)
- ✅ **정적/법적** — `/about` `/pricing`(완성, 가격 "문의") · `/terms` `/privacy`(초안, ⚠️법률검토 전)

**스캐폴드만 (placeholder, 미구현)**
- `/login` `/mypage` `/jobs/new` `/jobs/[id]/edit` (인증)
- `/admin` `/admin/jobs` `/admin/ingest` (운영자)

**드롭됨**: `/churches`(교회 목록 browse) · 교회 규모(대/중/소) 필드(누나 인터뷰: 기준 모호·"세상적" → 전면 제거).

**아직 안 함 (전부 의도적 연기)**: Supabase 연동·인증·실데이터, `'use cache'`+태그 실적용, sitemap/robots, 배포(Vercel). (딥그린+골드 테마·JobRow·노출등급 분리는 적용됨)

> **지난 스냅샷(6672c3c) 이후 변경**: 홈 검색 오버레이 · 교회 규모 제거 · 직분에 담임목사 추가 · "사역자 청빙" 포지셔닝 통일 · 데이터접근 seam(`lib/queries`) · INTERVIEWS.md 신설 · 누나 인터뷰 반영(ROADMAP 1-7).

---

## 2. 실행 / 검증

```bash
npm run dev          # 로컬 개발 (http://localhost:3000)
npm run build        # 프로덕션 빌드 = TS + Cache Components 검증 (가장 중요한 게이트)
npm run lint         # eslint
npm run format       # prettier --write
```

**코드 작성 후 항상**: `npm run build` + `npm run lint` 통과 확인. 확인 URL:
- `/jobs/job-001`(재공고 3회) · `/churches/ch-saesomang`(유초등부 재공고 3회 + 창립연도 + 채널3) · `/churches/ch-saebyeok`(이력 없음→섹션 숨김) · `/churches/ch-bitsogeum`(채널 없음)

---

## 3. 기술 스택 & 핵심 아키텍처 결정

- **Next.js 16.2.9** (App Router, **Cache Components** = `cacheComponents:true`), **React 19.2**, **TypeScript strict**
- **Tailwind v4** (CSS-first `@theme`), **shadcn/ui with Base UI**, **lucide-react ^1.22** (⚠️ 브랜드 아이콘 없음 — Youtube/Instagram 등은 generic 아이콘으로 대체)
- **Pretendard** self-host (`src/app/fonts/PretendardVariable.woff2`, `next/font/local`)
- 색: **딥그린 + 골드 확정·적용**(`globals.css` 토큰 — brand 램프 + gold + `--primary`=딥그린 + `.bg-hero`). 중립 neutral 위에 브랜드 그린. 다크 모드는 나중.
- **Supabase 미연동** (`@supabase/*` 미설치 — Phase 1)

**아키텍처 핵심 (CLAUDE.md 참조)**
- 공고는 변경 빈도 낮음 → 목표는 `'use cache'` + 태그 무효화. **단 지금은 mock 단계라 미적용**(seam만 준비됨).
- 상세(`[id]`)는 빌드타임 prerender 안 함 → 현재 params 의존 콘텐츠를 `<Suspense>`로 감싸 PPR(`◐`). 추후 on-demand `'use cache'` 전환. 홈은 `○` Static.
- **레이어**: `page.tsx`=조합만 / `*-view.tsx`=프레젠테이션(**기본 서버**, 인터랙션만 작은 client) / **`lib/queries/*`=데이터 소스 seam**(현재 `mocks/index.ts` 위임, DB 전환 시 본문만 교체) / `actions.ts`=mutation(아직 없음) / `components/**`=재사용 UI.

---

## 4. 방법론 (계속 이렇게)

**"페이지를 하나씩 만들며 필요한 필드를 mock JSON에 채운다 → 완료 시 이 JSON이 최종 스키마 → DATA.md 확정 → Phase 1에서 실 DB·인증."**

- mock: `src/mocks/{churches,jobs}.json` + `src/mocks/index.ts`. **페이지·뷰는 `@/mocks` 직접 import 금지 → `lib/queries/*`만** (seam).
- **디자인은 섹션 구조 먼저 → 컴포넌트 → 조합**(2026-07-02 방식 전환). 색·컴포넌트를 단독으로 던지면 판단이 안 됨 → 섹션 골격부터.
- 인증·mutation 페이지(로그인/등록/수정/mypage/admin)는 **mock으로 만들지 않는다** — 실 백엔드 위에서.

---

## 5. 데이터 모델 (현재 mock 스키마 = 확정 진행 중)

### enum (`src/constants/domain.ts`) — 영어 대문자 key + 한글 라벨
| enum | 값 |
|---|---|
| `DENOMINATIONS` | HAPDONG 예장합동 · TONGHAP 예장통합 · BAEKSEOK 예장백석 · GOSIN 예장고신 · HAPSIN 예장합신 · KIJANG 기장 · GAMLI 감리교 · SEONGGYUL 성결교 · BAPTIST 침례교 · SUNBOK 순복음 · ETC 기타 |
| `REGIONS` | 18개 광역 (SEOUL 서울 … OVERSEAS 해외) |
| `POSITIONS` (직분) | **SENIOR_PASTOR 담임목사** · ASSOCIATE_PASTOR 부목사 · EVANGELIST 전도사 · LICENSED_MINISTER 강도사 · ETC 기타 |
| `DEPARTMENTS` (부서) | INFANT 영유아부 · CHILDREN 유초등부 · YOUTH 중고등부 · YOUNG_ADULT 청년부 · DISTRICT 장년·교구 · WORSHIP 찬양·예배 · ADMIN 행정 · ETC 기타 |
| `EMPLOYMENT_TYPES` | FULL_TIME 전임 · SEMI_FULL_TIME 준전임 · PART_TIME 파트 |
| `FEATURED_TIERS` (노출) | NONE 일반 · PREMIUM 프리미엄 · HERO 대표광고 |
| `JOB_SOURCES` | OPERATOR 운영자 등록 · CHURCH 교회 직접 등록 |
| `CHURCH_CHANNELS` | HOMEPAGE 홈페이지 · YOUTUBE 유튜브 · INSTAGRAM 인스타그램 · FACEBOOK 페이스북 · BAND 밴드 (노출 순서 = 정의 순서) |

> **직교화 원칙**: 직분·부서·고용형태를 **분리된 축**으로. 혼합 라벨("전임전도사") 안 만듦.
> ⚠️ **교회 규모(CHURCH_SIZES) 제거됨**(2026-07-02). **부서 재설계 예정**(세분화+복수선택+교단별 별칭 — ROADMAP 1-7, 미착수).

### 타입 (`src/types/domain.ts`)
```ts
Church  = { id, name, denomination, region, city|null, foundedYear|null, links: ChurchLink[] }   // size 제거됨
ChurchLink = { type: ChurchChannel, url: string }
Job     = { id, churchId, title, position, department|null, employmentType,
            stipendMin|null, stipendMax|null, stipendNote|null,   // 만원 단위, note="내규에 따름" 등 비정형 보존
            status: "OPEN"|"CLOSED", featuredTier, postedAt("YYYY-MM-DD"), deadline|null,
            workDays|null, requirements: string[], preferred: string[], requiredDocs: string[],
            description|null, source: "OPERATOR"|"CHURCH", sourceUrl|null }
JobCard = 목록 카드 projection (job + church:{name,denomination,region,city})   // size 제거됨
JobDetail = { job, church }
FilterDim = denomination|region|position|department|employmentType   // size 제거됨
SortKey   = recent|stipend|deadline
```
`src/lib/repost-tracking.ts`: `REPOST_MIN_COUNT=2`, `repostKey=churchId:position:department`, `getRepostInfo`, `groupByRole`.

### 조회 seam (`src/lib/queries/*.ts` — **이제 존재**, mock 위임)
- `queries/jobs.ts`: getAdJobs(HERO) · getListJobs(HERO 제외·프리미엄 우선) · getAllJobCards · getJobStats(모집중·새공고·함께하는교회) · getJobDetail · getRepost · getSimilarJobs · getChurchOpenJobs · **getSearchSuggestions**(검색어 완성 후보)
- `queries/churches.ts`: getChurch · getChurchTimeline
- 각 함수 `'use cache'` + `cacheTag`. 본문은 현재 `mocks/index.ts` 호출 → DB 전환 시 본문만 교체.

### 클라 저장 (localStorage) — `lib/recent-jobs.ts` · `recent-searches.ts` · `bookmarks.ts` (`constants/storage.ts` 키)

### mock 데이터 현황
- **churches.json** — 8개 교회. 채널 다양성, 창립연도(일부 null). (규모 필드 제거됨)
- **jobs.json** — 16개(job-001~016). featuredTier(HERO 2·PREMIUM 3), status(OPEN 12·CLOSED 4). 재공고 데모: 새소망 유초등부 3회, 반석 중고등부 2회.

---

## 6. 확정 페이지 섹션 (상세는 SPEC.md)

**홈 `/`**: 딥그린 히어로(검색 오버레이+지표3) · 추천 청빙(대표광고 = `FeaturedJobCard` 슬롯) · 2단[청빙 공고 리스트(`JobRow`: 제목 주인공·텍스트만·프리미엄=태그+상단고정) + 사이드바(추천검색어·교회CTA)]. 탭 없음. 남음: 푸터. (진행 §9)

**공고 목록 `/jobs`**: 검색(라이브 필터) · 대표광고(AD) · 좌 필터(교단·지역·직분·부서·고용형태 — **규모 제거됨**) · 정렬(최신 중심, 사례비순·마감임박순 재검토) · 리스트(프리미엄 상단) · 우측 레일(최근 본 공고·배너) · 페이지네이션(8/p) · 모바일 Sheet. mock 클라 필터(`filter-jobs.ts`).

**공고 상세 `/jobs/[id]`** (2단, 좌 본문 플로우 + 우 sticky 사이드바, 본문 카드 없이 제목+구분선):
- 좌: 헤더 / 자격요건 / 우대사항 / 공고안내 / 교회정보(+다른 모집)
- 우 사이드바: 핵심조건(사례비·마감·출근·고용형태·서류) / 지원안내(원문·교회홈피 CTA, 사이트 내 지원 없음) / ★교회 채널
- 하단: 비슷한 공고 · 출처 · 오류 문의 / SEO: JobPosting JSON-LD
- ⚠️ **레이아웃 재고 예정**(누나: 핵심조건을 우측 sticky에만 두면 시선이 마지막에 감 → 눈에 띄게, ROADMAP 1-7)

**교회 상세 `/churches/[id]`** (단일 컬럼): 헤더(이니셜 아바타+교단·지역·창립연도+채널) / 현재 모집 / ★공고 이력("시안 C": 요약문장 + `<details>` 토글, 단발 제외·없으면 숨김). 제외: 리뷰·연봉·통계(integrity·데이터 없음).

---

## 7. 파일 맵 (실제 존재)

```
src/
├── app/
│   ├── (public)/ layout · page(홈)
│   │   ├── jobs/ page · jobs-view(client) · filter-jobs(순수) · [id]/{page, job-detail-view}
│   │   ├── churches/[id]/{page, church-detail-view}
│   │   ├── about · pricing · terms · privacy /page  ← 완성(정적)
│   ├── (authed)/ mypage · jobs/new · jobs/[id]/edit  ← 스캐폴드
│   ├── admin/ page · jobs · ingest  ← 스캐폴드 · login/page ← 스캐폴드
│   ├── layout(root, Pretendard·메타=사역자 청빙) · globals.css(딥그린+골드 토큰·.bg-hero) · fonts/
├── components/
│   ├── job/ job-card · **job-row** · **featured-job-card** · **bookmark-button**(client) · job-filter · pagination · recently-viewed · record-recently-viewed · job-actions
│   ├── home/ **home-sidebar**(추천검색어·교회CTA) · search/ search-box(client, 오버레이) · **relative-time**(client, N일 전)
│   ├── church/ church-channels · layout/ header(딥그린) · footer · placeholder · legal-doc
│   └── ui/ badge · button · card · input · sheet (shadcn Base UI)
├── constants/ domain.ts(enum) · storage.ts
├── lib/ queries/{jobs,churches}.ts(seam) · recent-jobs · recent-searches · **bookmarks** · format(+jobRoleLine) · repost-tracking · seo · utils
├── mocks/ churches.json · jobs.json · index.ts
└── types/ domain.ts
```
> ⚠️ `lib/supabase/*` · `lib/ingest/*` · `proxy.ts` · `actions.ts` · `types/database.ts` — CLAUDE 트리엔 있지만 **아직 없음**(Phase 1).

---

## 8. 확정된 설계 결정 로그 (되돌리지 말 것)

- **공고 상세 = 시안 A**(본문 플로우 + sticky 사이드바). "네모네모" 카드 파편화 폐기.
- **교회 상세 이력 = 시안 C**(요약 문장 + `<details>` 토글).
- **`/churches` 목록 드롭** · **포스터 이미지 미채택**(재호스팅 저작권+YAGNI → `sourceUrl`) · **교회 채널 일반화**(`links[]`+enum) · **claim 제거**.
- **창립연도 추가**. 담임목사 이름·전체주소·예배시간은 교회 **필드**로 미채택(개인정보·지도 Phase 2). ※ 직분 enum 담임목사와 무관.
- **교회 규모(대/중/소) 전면 제거**(2026-07-02, 누나·어머니: 기준 모호·"세상적").
- **직분에 담임목사 추가 + "사역자 청빙"으로 포지셔닝 통일**(2026-07-02). 주력은 부교역자, SPEC 스코프·전 카피 정리 완료.
- **홈 스탯 "청빙 중 교회" 제거**(모집중과 혼동).
- **검색: 진입=오버레이**(홈, 최근검색어+최근본공고+검색어완성) / **목록=라이브 필터**(/jobs) / **별도 검색 페이지 없음**(결과=`/jobs?q=`). 검색어 완성 후보 = 열린 공고의 직분·부서·지역·교단 라벨+교회명(결과 0건 제외).
- **데이터접근 seam**(`lib/queries`, async+`'use cache'`+`cacheTag`, mock↔DB 본문만 교체).
- **CLAUDE View 규칙**: `*-view.tsx` 기본 서버 컴포넌트, 인터랙션만 작은 client.

---

## 9. ▶ 홈 재디자인 진행 (여기서 이어서)

**방식**: 섹션 구조 먼저 → 컴포넌트 → 조합. 색은 토큰이라 나중 스왑 가능.

**색 = 딥그린 + 골드 (확정·구현 완료, `globals.css`)**: 램프 `--brand-900 #15332a · 800 #1b3f34 · 700 #234f41 · 600 #2f5d50`, `--gold #d3ad63`, `--primary`=#2f5d50, `.bg-hero`(라디얼 그라데이션). 방향성 = 잡코리아식 이미지-과밀(세상적) 회피 → **이미지 없이 완성도**(아바타·칩·깊이·아이콘·섹션 밴드).

**홈 메인은 카드 그리드 아님 → 리스트(번호 없음).**

✅ **완료된 섹션**
1. **헤더**(딥그린, 전역): 로고(골드 Min+화이트 Job) + nav(공고) + 로그인. 교회 공고등록 CTA는 헤더에서 제거(→ 사이드바 CTA).
2. **히어로**(딥그린 풀블리드·중앙): eyebrow + 헤드라인 "다음 사역지, 여기서 찾으세요" + 흰 검색바(SearchBox restyle) + 지표 3개(모집 중·새 공고·함께하는 교회).
3. **추천 청빙(대표광고)**: `FeaturedJobCard`(초록 테두리 카드, 2열) 별도 슬롯.
4. **청빙 공고 리스트**: `JobRow` — **제목 주인공 · 텍스트만(아바타·번호 없음)** · 직분/부서/고용 평문 · 지역(핀) · 사례비(초록) · N일전 · 책갈피. **프리미엄=태그+상단고정(틴트 없음)**, 대표광고는 위 슬롯. `getListJobs`(HERO 제외·프리미엄 우선+최신). **탭 없음.**
5. **사이드바**(`home-sidebar`): 추천 검색어 8칩(큐레이션)→`/jobs?q=` · 교회 CTA(딥그린)→`/jobs/new`.

⬜ **남은 섹션**
6. **푸터** restyle (아직 light → 딥그린 톤 정리).
+ 그 뒤: 톤을 `/jobs`·상세로 확산 + **공고 상세 사이드바 레이아웃 재고**(핵심조건 눈에 띄게, 누나 인터뷰).

**설계 확정(구현됨)**: 노출 등급 = 대표광고(별도 카드 슬롯) / 프리미엄(태그+상단고정, 틴트 없이 organic에 가깝게 — 표시광고법·신뢰) / 일반(리스트). 왼쪽 요소 없음(로고 없어 텍스트만). 북마크=책갈피. 고용형태 탭 폐기. 지표 교단 제외. **3-피처(기능 소개 스트립) 제외** — 홈 콘텐츠가 가치를 이미 증명 + /about 중복 + 세상적 회피.
