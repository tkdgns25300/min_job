# MinJob — 작업 로드맵

> 페이지·기능 명세는 [`SPEC.md`](./SPEC.md), 데이터 모델은 [`DATA.md`](./DATA.md), 아키텍처는 [`../CLAUDE.md`](../CLAUDE.md).
> 브랜치: `prod`(배포) / `dev`(작업). commit·push·merge는 사용자 명시 요청 시에만.

> **이 로드맵은 코드 작업만이 아니다.** 양면 시장 서비스라 "공고 확보(운영)"·"마케팅"·"법률 검토"가 개발과 병행돼야 한다. 각 Phase에 병행 트랙을 함께 둔다.

## Phase 0: 프로젝트 셋업

### 환경·골격 (지금 가능)
- [x] `prod`(배포)·`dev`(작업) 브랜치 구성 + 원격 푸시
- [x] CLAUDE.md, docs/(SPEC·ROADMAP·DATA), .gitignore
- [x] Next.js 16 + React 19 + Tailwind v4 + TS strict + Prettier (Cache Components 활성)
- [x] Pretendard 폰트(self-host) + 라이트 디자인 토큰
- [x] shadcn/ui (Base UI) + 시드 컴포넌트(button·card·badge·input)
- [x] 앱 셸: 레이아웃·헤더·푸터·홈 + (public)/(authed)/admin 라우트 뼈대
- [x] README
- [x] Supabase 프로젝트 생성 + 클라이언트(`lib/supabase/{server,service,session}.ts`) — `server`·`session`은 인증에서 실사용, `service`는 아직 미사용(DB 전환 시)
- [x] Proxy — `src/proxy.ts` (2026-07-29): **세션 refresh + 비로그인 1차 차단(진짜 307)**. ⚠️ 원래 계획한 "(authed)/admin 인증 게이트"와 다름 — cacheComponents 제약상 페이지 안 redirect는 200+스켈레톤이 되므로 proxy가 1차, 페이지 `requireUser`가 최종 방어선인 **2단 구조**로 결정. **admin도 게이트 적용**(`/admin/**` 비로그인 307 + 비운영자 → `/`, Auth 장애 시에도 fail-closed)
- [x] **운영자(admin) 게이트** (2026-07-29) — `.env` `ADMIN_EMAILS`(쉼표 구분) allowlist. `proxy.ts`가 `/admin/*`에서 비로그인은 307, 로그인했어도 운영자 아니면 `/`로. PII 화면 `/admin/verify`는 페이지에서도 `requireOperator()` 재확인(fail-closed: 목록이 비면 아무도 접근 못 함). 판정은 JWT claims의 email로 하므로 추가 왕복 없음. ✅ **Vercel env `ADMIN_EMAILS` 등록·prod 실동작 확인 완료(2026-08-11)**. 남은 것: 실 DB 전환 시 operator RLS.
- [x] `.env` 로컬 셋업 (Supabase 키) — URL·publishable·secret 3개 설정 완료
- [x] Vercel 연결 + 첫 배포 (2026-07-18) — https://min-job.vercel.app/ (mock 데이터, 시크릿 없음)

### DB 스키마 (DATA.md 확정 완료 — Phase 1에서 구축)
> DATA.md에 스키마·enum·인덱스·RLS·노출 모델 확정됨. 아래는 Phase 1에서 진행.
- [x] **DATA.md 작성** — 봉인 결정 확정(정규화/JOIN·직교화·enum·노출 2종·사례비 period·RLS 의도)
- [x] **`jobs` 미확정 7필드 확정 + nullable 원칙**(2026-08-04) — DATA.md §3의 ⚠️ 블록 해소. 신규 컬럼 `headcount`·`start_timing`·`process_steps`·`optional_docs`·`housing_note`·`benefit_note`, `employment_type` NOT NULL→NULL, `housing_provided` nullable boolean(**enum 신설 X** — DEFAULT false가 "언급 없음"을 "미제공"으로 왜곡). 근거 = 크롤링 원문 3,051건 언급률 실측(고용형태 51%·사택 40%)
- [x] **스키마 6개 결정 확정**(2026-08-05) — 위 nullable 원칙을 조이고 구조를 정리했다. DATA.md §2·§3·§5·§7·§9·§12 반영:
  1. `position`/`role` **분리 유지** + **XOR CHECK** — 합치면 한 칼럼이 "통제 enum + 자유텍스트" 두 값 공간을 가져 TS 타입이 `string`으로 무너진다. CHECK로 "일반직인데 직분이 박힌" 행을 존재 불가로
  2. `stipend_*` → **`pay_*` 개명**(코드 완료, 21파일) — 일반직(GENERAL)은 사례비가 아니라 근로계약 급여라 `stipend`가 절반만 맞았다. 한글 라벨은 `job_kind`로 분기
  3. 연락처 = **`jobs`에 컬럼 4개**(`contact_email`·`tel`·`link`·`post`) — `APPLY_METHODS`가 `ETC` 없는 닫힌 4키라 컬럼이 1:1. 별도 테이블(`church_links` 방식)은 열린 집합용이라 부적합
  4. **`apply_methods` jsonb + `contact` 단일 폐기** — 3번에 흡수(같은 것을 두 형태로 저장하던 설계)
  5. **`job_promotions` 테이블 신설**(결제 원장, `UNIQUE(payment_id)`로 멱등) + `jobs.featured_tier`·`featured_until`은 **캐시 컬럼으로 유지** — HERO 구좌 판정·환불·이력은 원장이, 정렬 1차 키는 캐시가. 만료는 **seam이 `todayInSeoul()`을 만들어 넘긴다**(cached scope 계산 · 하루 1캐시 · Cron 불필요)
  6. **최소 조건 = 필수 4 + CHECK 2**(→ `posted_at` 복귀로 **현재는 필수 5**, 2026-08-14) — `description` NOT NULL 승격(요약 없으면 링크만 있는 빈 껍데기 = 가드레일 #1 위반)
- [x] **최소 조건을 크롤러 실데이터 3,181건으로 검증**(2026-08-05) — 초안 8개를 **6개로 줄였다**. DATA.md §3 "최소 조건" 절이 정본:
  - **필수 4** ~~`church_id`~~ → **`church_name`**(2026-08-06 교체, 아래 항목) · `title` · `job_kind` · `description` / **CHECK 2** 직분 XOR 직무 · **연락처 ≥1**
  - **필수에서 뺀 3개** — `churches.denomination`(원문 명시 **2.8%**, 교회 1,004곳 수동은 비현실) · `churches.region`(광역 81%) · `jobs.posted_at`(**PCKWORLD 60건** — 게시판이 날짜를 안 줌)
  - **CHECK ②에서 `source_url`을 뺐다** — 세면 크롤링 공고는 항상 통과해 제약이 장식이 된다. 빼면 크롤링은 연락처를 채우게 되고(품질 상승) 교회 등록은 자동으로 연락처 필수
  - 연락처는 **4컬럼 유지**(1칼럼 text로 되돌리지 않음) — 실측 **75.4%가 2종 이상**이라 text 하나면 뭉개지고 `mailto:`/`tel:` 링크를 못 만든다(모바일 UX)
  - ✅ **`posted_at`은 NOT NULL로 복귀**(2026-08-14, 크롤러도 필수 확정) — nullable의 대가 3가지(JSON-LD 생략·정렬 폴백·타입 null 처리)가 전부 사라졌다
  - ⚠️ **`church_id` 자동 매칭 금지** — 동명이교회 실측(선민교회 HAPDONG ×3 · GAMLI ×1). 이름 매칭하면 **남의 교회 페이지에 남의 공고가 뜬다**(되돌리기 어렵다). 후보 제시만, 확정은 운영자
- [x] **교회 식별을 claim으로 미룸 — 스키마 3개 변경**(2026-08-06, 크롤러 요청 수용. **위 `church_id NOT NULL`을 뒤집는다**):
  - `jobs.church_id` **NOT NULL 해제**(NULL = 아직 확정 못 함) · **`jobs.church_name text NOT NULL` 추가**(공고가 말한 그대로) · **`jobs.region text NULL` 추가**
  - **근거(크롤러 실측)**: 교회 묶기가 자동 95%까지만 되고 사각지대가 남는다 — (교회명+광역) 1,203그룹 중 **검증 불가 67개**('일관'처럼 보이나 다른 교회일 수 있음) · **같은 연락처에 다른 교회명 83건**(표기 차이 + 교단 사무실 공유). **사람이 봐도 판정이 안 된다.** 다른 교회를 합치면 되돌리기 어렵고(이미 공개), 안 합치면 나중에 병합 가능 → "증거 없으면 합치지 않는다"를 끝까지 밀어 **교회 행을 아예 만들지 않는다**
  - 교회가 가입·인증 후 **claim**하면 `church_id`가 채워지고 교회 상세가 켜진다 → **claim이 교회 가입 유인이 된다**(mock `job-101` 클레임 데모와 같은 개념)
  - **필수 4의 1번이 `church_id` → `church_name`으로 교체**(커버율 96%, 없는 124건은 제약이 자동 차단). 개수는 그대로 4개
  - ⚠️ **`jobs.region`은 §1 "비정규화 금지"의 명시적 예외** — `church_id`가 NULL이면 JOIN이 성립 안 해 지역 필터가 통째로 죽는다(크롤링 공고 80%). `featured_tier`와 같은 취급으로 §1에 예외 2개를 명시했다
  - **대가**: `/churches/[id]`는 claim된 교회만 · 교단 필터도 claim 전까지 안 걸림(명시 2.8%라 영향 작음) · **재공고 추적은 아예 제거**(위 결정 완료 2번)
- [x] **`position`·`job_kind` 배열화 확정**(2026-08-07) — 한 글에 자리가 여럿인 공고를 표현하기 위해. DATA.md §2·§3(판정 규칙 절)·§5 반영:
  - **`position text[]`** — 한 자리에 여러 직분 자격을 열어둔 공고가 **826건**. 대표 1개만 담으면 나머지로 검색한 사람에게 안 보인다(= 지원자를 놓친다)
  - **`job_kind text[]`** — 혼합 공고("교육전도사 2명 · 관리직원 1명")를 **지금 스키마는 표현 자체를 못 한다**(CHECK가 position+role 동시 보유를 금지) → 크롤러가 만나면 반드시 절반을 버려야 했다. 실제 건수는 121건(3.8%)보다 적지만 비용이 타입 1곳+mock뿐이라 채택
  - **CHECK ① biconditional로 재작성** — 🔴 **`array_length` 금지**: 빈 배열에 NULL을 반환하는데 Postgres CHECK는 **NULL을 통과**시킨다(FALSE일 때만 거부). 그대로 두면 "직분 없는 사역직 공고"가 들어온다. **`COALESCE(cardinality(...), 0)`** 형태로. 실 Postgres 8케이스 검증 완료(min_job_agent)
  - **인덱스 GIN** + 필터는 `=` → **`@> ARRAY['X']`**
  - **`department`·`employment_type`은 단일 유지** — 다중 케이스가 2%대(69건·76건)라 NULL로 감수. 배열화하면 코드가 대폭 늘고 실익이 작다
  - **필드별 판정 규칙**: "자리가 몇 개냐"가 아니라 필드마다 **"적혀 있나 → 하나로 정해지나"**. 자리 수가 영향을 주는 칸은 `job_kind`·`position`(배열)·`headcount`(원문 보존) 셋뿐
- [ ] **배열화 코드 반영** — ⚠️ 구조화 결과 확인 후 착수(스키마 SQL과 한 묶음):
  - 선행: **`jobRoleLine`(format.ts) / `jobRoleSummary`(seo.ts) 중복 통합** — 완전히 같은 3줄이 복붙돼 있어, 통합 전에 배열화하면 축약 로직을 두 번 쓴다
  - `job_kind`: 타입 1곳 + mock (UI 미구현이라 그 외 0곳)
  - `position`: 타입 4곳 + `filter-jobs.ts`(매칭 한 줄 — **필터 UI·URL 상태는 이미 `Set`이라 무변경**) + 검색 인덱스·`bump` + 표시(format·seo·admin-job-row·my-job-row) + 상세 링크 + mock 101건
  - 폼: **`ChipSelect` 다중화**(이미 칩 UI라 토글만) · admin ingest의 `EnumSelect`는 **새 다중선택 필요**
  - 목록 카드 축약 **"부목사 외 2 · 유초등부"**(상세에선 전부 표시)
  - ⚠️ `ChurchVerification.applicant.position`은 **배열화 제외**(담당자 개인 직분)
- [x] ✅ **공개 노출 만료 규칙 구현 완료**(2026-08-14 착수 → 구현 확인 2026-08-19) — DATA.md §6-1이 정본. `status`는 OPEN 유지하고 **파생 계산**으로 숨긴다(배치·Cron 없음).
  - `constants` **`ALWAYS_OPEN_MAX_DAYS = 90`** · `mocks/index.ts`의 **모듈 상수 `openJobs` → 함수**(지금은 서버 시작 시각에 고정돼 날짜 조건을 못 쓴다) + `isPubliclyOpen(job, today)` 도입(사용처 9곳)
  - `lib/queries/jobs.ts` **cached scope 안에서 `today` 계산**해 mock에 전달 — 호출부가 전부 프리렌더라 인자로 넘기면 빌드 시각이 굳는다(CLAUDE.md 제약 #2)
  - 만료 시 `JobPosting` 미출력(게이트는 `jobs/[id]/page.tsx` — `seo.ts`의 조립 함수엔 만료 판정이 없다) · 상세에 "마감" 배너 · `getJobStats`의 "최신 게시일을 오늘 대신 쓰는" 우회 제거
  - 교회 대시보드에 "게시 90일 경과 — 갱신하면 다시 노출" 안내
  - ⚠️ `sitemap.ts`·페이지는 **변경 없음** — seam이 걸러준다
- [~] **NULL 표시 UI**(스키마를 푼 대가 — 안 하면 모르는 것을 아는 척한다. ~~게시일~~ 은 필수 복귀로 제외). **표시 규칙은 확정·구현 완료**(2026-08-16 교회 조인 정합): 공개 화면은 모르는 조각을 **생략**하고(`format.ts`의 `churchLocation`·`denominationLabel`), 운영자 화면만 "미상"을 명시한다. ⏸ **남은 것은 `denomination_source` 게이팅뿐**(`stated`·`registry`·`operator`일 때만 확정 표시) — 그 컬럼이 DB에 있어야 해서 마이그레이션과 한 묶음: **검수 우선순위는 교단보다 지역**(비면 지역 필터에서 탈락 = 사실상 안 보이는 공고)
- [ ] ⏸ **크롤러 구조화 데이터 유입 후 착수**(2026-08-16 결정 — 구조는 확정, 실데이터가 바꾸는 건 제약 임계값뿐. 신규 DB라 미루는 비용 거의 없음) 마이그레이션 `001_init.sql` — churches·church_links·church_photos·jobs·**job_promotions**·users(+bookmarks Phase 2) + enum CHECK + **jobs CHECK 4개**(①직분↔직무 ②연락처≥1 ③수집공고 source_url ④교회등록 church_id) + **users CHECK 2개**(APPROVED면 church_id 필수 · REJECTED면 사유 필수) + 인덱스 + RLS (DATA.md §3·5·9). **신규 DB이므로 `ALTER`가 아니라 `CREATE TABLE`에 직접**. ⚠️ **증빙 서류용 비공개 Storage 버킷**(operator만 읽기)도 여기서 함께 만든다 — 테이블 목록에 없어 빠뜨리기 쉽다(`users.verification_doc_path`가 가리키는 곳)
- [x] **결정 완료(2026-08-07) — 중복/재공고는 지금 안 한다**:
  1. **끌어올림(bump) 판정은 min_job 일이 아니다** — 크롤러(min_job_agent)가 수집 단계에서 묶고, **min_job admin 검수 화면에서 "이거 끌어올리시겠습니까?"** 로 운영자에게 확인받는다. 우리는 N일 임계값을 정하지 않는다
  2. **재공고 추적 기능 자체를 제거**(보류) — `lib/repost-tracking.ts` 삭제. 판정 키가 `church_id`에 묶여 있었는데 그게 nullable이 되면서 claim 전 공고가 전부 `null:직분:부서` 한 덩어리로 합쳐져 **거짓 숫자를 공개**하게 된다. "안 잡힌다"가 아니라 **틀린 값이 나온다**는 게 제거 이유. 되살리는 조건·후보 키는 DATA.md §6
  3. **`owner_id` 컬럼 제거** — 유일한 사용처 `getEditableJob`이 이 컬럼으로 편집 권한을 판정하고 있었는데 그게 가드레일 #2 위반이었다(담당자는 여럿·교체됨). 권한을 `church_id` 기준으로 바꾸고 컬럼을 없앴다
- [x] 📮 **크롤러(min_job_agent)에 회신 완료(2026-08-11)** — 아래 4건 전달. min_job 쪽 확정이 `review_data`에 반영돼야 검수 브릿지가 무엇을 받을지 정해진다. `review_data`는 **min_job_agent 소유**라 우리가 바꾸지 않고 **회신 → 그쪽 반영** 또는 **승격 시 매핑**한다.
  1. **`stipend_*` → `pay_*` 개명** (min_job 코드 완료 2026-08-07) — 일반직은 사례비가 아니라 근로계약 급여라 `stipend`가 절반만 맞았다
  2. **`contact` 단일 → 4컬럼**(`contact_email`·`contact_tel`·`contact_link`·`contact_post`) — 실측 **75.4%가 2종 이상**이라 한 문자열에 뭉개면 `mailto:`/`tel:` 링크를 못 만든다(모바일 UX). `APPLY_METHODS`가 `ETC` 없는 닫힌 4키라 컬럼이 1:1
  3. **교단 미상 = `NULL`**(`ETC` 아님) — `ETC`는 "소속은 있고 우리 9키에 없는 교단"(기장)이라 미상을 섞으면 필터·거점 판정이 오염된다. ~~"미상 교단은 승격 전 해소"~~ 규칙은 **철회**(무소속·독립교회가 실재)
  4. **`job_kind` 배열화** — 혼합 공고("교육전도사 2명 · 관리직원 1명")를 지금 스키마는 **표현 자체를 못 한다**(CHECK가 `position`+`role` 동시 보유를 금지) → 크롤러가 만나면 반드시 절반을 버려야 했다. `position` 배열화와 같은 이유·같은 CHECK로 해소(min_job 코드 완료 2026-08-07)
  > 승격 게이트도 함께 전달: **필수 5**(`church_name`·`title`·`job_kind`·`description`·`posted_at`) **+ CHECK 2**(job_kind↔position/role 상호 일치 · 연락처 ≥1, `source_url`은 안 셈). 크롤러가 맞출 6개 = 교회 매칭 · 제목 · job_kind · 직분 또는 직무 · 요약 · 연락처 1개. **교단·지역·게시일은 비어도 승격 가능.**
  > ⚠️ **CHECK에 `array_length` 쓰지 말 것** — 빈 배열에 NULL을 반환하고 Postgres CHECK는 **NULL을 통과**시켜, "직분 없는 사역직 공고"가 들어온다. `COALESCE(cardinality(...), 0)` 형태(DATA.md §3). 실 Postgres 8케이스 검증 완료
- [x] 📮 **전달 완료(2026-08-11) — `review_data.published_job_id`가 단수다.** Phase 2에서 한 글의 여러 자리를 `jobs` N건으로 나누려면 **어느 것을 기록할지 정할 수 없고** 다음 크롤에서 재등장 방지가 깨진다. 그때 배열(`published_job_ids`)이나 조인 테이블이 필요하다 — min_job_agent 소관이라 **미리 알려두기만** 한다
- [ ] DB 타입 생성 — `types/database.ts`
- [x] ✅ **교회 조인 경로 정합 (2026-08-16 — 드리프트 5곳 선행 해소)** — claim 결정(2026-08-06)이 DATA.md에만 반영돼 있어 코드가 **없는 값을 지어내고 있었다**: 조인 실패 시 교단을 `ETC`, 지역을 `SEOUL`로 메우고(→ 미상이 기타교단·서울로 둔갑해 필터 오염), 공고 상세는 교회가 없으면 **404**를 냈다(→ 크롤 공고가 통째로 안 열림). 함께 고친 것: `getSimilarJobs`의 `churchId` 비교(둘 다 NULL이면 무관한 교회가 "같은 교회"로 묶임) · `getSearchSuggestions`(크롤 교회명 누락) · `getJobStats`(NULL이 한 덩어리로 접힘) · `getCoverageStats`(NULL을 교단·지역 하나로 셈).
  - 해소된 드리프트: **`Church.denomination`·`Church.region` nullable** · **`Job.churchName`·`Job.region` 추가** · **`Job.churchId` nullable**
  - 새로 생긴 것: `types/domain.ts`의 `JobChurchRef`(조인 결과가 아닌 "공고가 가리키는 교회") · `lib/job-church.ts`(`jobChurchRef`·`normalizeChurchName`·`churchIdentityKey`)
  - 표시 규칙은 SPEC(공고 상세 §미claim 축소 표시)에 확정 — 공개는 조각 생략, 운영자만 "미상" 명시
- [x] ✅ **교회 인증 스키마 확정 (2026-08-18)** — **새 테이블 없이** 기존 7개로 해결. DATA §1·§3·§9·§11 반영:
  - `churches` **+3** — `verification_status`(NOT NULL DEFAULT 'PENDING' — 행 생성 경로가 둘이고 **승격은 `APPROVED`를 명시**해야 한다, 안 하면 승격 교회가 전부 상세 404) · `contact_email` · `contact_tel`
  - `users` **+8** — 증빙 Storage 경로 · 담당자 실명·직분 · **신청 사무용 전화·이메일** · 제출/검수일 · 반려 사유. **CHECK +2**(APPROVED면 `church_id` 필수 · REJECTED면 사유 필수)
  - **신청 연락처를 `churches`에 바로 쓰지 않는다** — 미승인 신청자가 이미 인증된 교회의 대표 연락처를 덮어쓸 수 있다. `users.verification_contact_*`에 받고 **승인 시 옮긴다**
  - **담당자 개인 전화는 수집하지 않는다** — 신청자가 적은 번호로 확인 전화를 걸면 **사칭자가 자기 번호를 적고 자기가 받아** 검증이 성립하지 않는다. 검증축은 **교회 사무용 연락처 대조**(공개 게시판 공고·홈페이지). 등록번호도 안 받는다(서류를 열면 보이고, 저장하면 보관 부담만)
  - **`hasChurchAccess`가 사람·교회 양쪽을 본다** — 사람만 승인하고 교회가 미검증이면 검수 안 끝난 교회가 공고를 올린다. `CurrentUser`에 `churchIsVerified`·`churchRejectionReason`을 실어 호출부 8곳이 한 곳도 빠뜨리지 않게 했다
  - **공개 조회는 `APPROVED`만**(`mocks`의 `publicChurchOf`) — ⚠️ **RLS는 이 경로를 못 막는다**(공개 교회 조회는 cached read라 `service.ts` secret 키를 쓰고 그건 RLS 우회). 조건은 쿼리 본문이 유일한 방어선이다. sitemap도 전용 조회(`getIndexableChurchIds`)로 분리 — 운영자용 목록을 재사용하면 검수 중 교회 URL이 색인돼 404가 된다
  - ⏸ **남은 것 = Server Action 2개뿐** — 화면·타입·mock은 확정 완료. `mypage/verify/actions.ts`(제출)·`admin/verify/actions.ts`(승인·반려 + 증빙 즉시 파기) 단계별 명세는 **SPEC 교회 인증 절**이 정본. 테이블·Storage 버킷은 아래 `001_init.sql`과 한 묶음
> ⛔ **`/admin/jobs`에 "미상" 필터·카운터를 만들지 않는다 (2026-08-17 판단 철회)** — DATA §3의 *"검수에서 채울 값"*을 `/admin/jobs`로 잘못 읽고 한때 할 일로 올렸다. 그 검수는 **승격 전** 브릿지(`/admin/ingest` → `review_data` 보정 후 `jobs`로 INSERT)를 말한다. `/admin/jobs`는 **이미 공개된 공고**를 관리하는 화면이라 애초에 그 일을 하는 자리가 아니고, 미상 공고도 기본(전체) 목록에는 그대로 조회된다. 사후 수정이 필요하면 제목·교회 검색으로 찾는다.
- [ ] ⚠️ **`types/domain.ts`·mock ↔ DATA.md 정합 (나머지 15곳)** — 스키마 확정(2026-08-05~06)이 **문서에만 반영됐고 코드는 아직 옛 스키마다.**
  - **TS가 DB보다 엄격**(DB가 NULL을 주면 타입이 거짓말 → 런타임 오류): `position` · `employmentType` — nullable로 풀어야 함. (`postedAt`은 NOT NULL 복귀로, `Church.denomination`·`Church.region`은 위 항목으로 **해소**)
  - **TS가 DB보다 느슨**(폼이 NULL을 보내면 DB가 거부): `description: string | null` → **`string`**. ⚠️ 실제 모순이라 이 상태로 등록 Server Action을 붙이면 런타임 에러
  - **타입에 아예 없는 필드 12개**: `contactEmail`·`contactTel`·`contactLink`·`contactPost`(현재 `contact` 1개) · `headcount` · `startTiming` · `processSteps` · `optionalDocs` · `housingNote` · `benefitNote` · `featuredUntil` · `payPeriod`
  - 함께 필요한 것: mock JSON 101건에 신규 필드 채우기
  > **타이밍 = 마이그레이션과 한 묶음.** 지금 손으로 맞추면 `types/database.ts` 생성 때 같은 일을 두 번 한다. 순서: `001_init.sql` → `database.ts` 생성 → `domain.ts` 정합 → mock JSON 전환 → `lib/queries` 본문 교체. **이 항목이 마이그레이션 작업의 전제조건이다.**
  > ⚠️ 원래 "18곳"이라 적었으나 실제 열거는 20곳이었다(`postedAt` 해소 후 개수를 다시 세지 않은 탓). 위 5곳을 뺀 **15곳**이 남은 정확한 수다.

**병행 트랙 (Phase 0~1 내내)**
- [x] 도메인 확보 — **minjob.co.kr**(hosting.kr 등록). (.com은 일본 서비스 선점)
- [~] 도메인 → Vercel 연결 (2026-07-20) — hosting.kr DNS에 A `@`→216.198.79.1 + CNAME `www`→(Vercel 발급) 추가함. **전파·SSL 발급 대기**(Valid 뜨면 완료). 대표주소 = `www.minjob.co.kr`(apex→www 308)
- [ ] **브랜드 이메일**(`contact@minjob.co.kr`) — **무료로 개설 예정, 방식 미정**: ① ImprovMX 포워딩(받기만→네이버) / ② Zoho Mail 무료(받기+보내기). hosting.kr DNS에 MX+SPF(②는 DKIM도) 추가. 개설 후 `constants/business.ts`의 `email` 한 줄만 교체하면 사이트 전체 반영(단일 소스). 지금은 `tkdgns25300@naver.com` 사용
- [~] **법률 검토**: 데이터 수집 방식 = **크롤러 자동 수집(공개 공식 게시판)으로 전환** → **IT·지식재산 변호사 검토 완료(2026-07-28)** (가드레일 #1·#3 재정의 근거, 크롤러 실운영 전제 충족). 남은 것: **약관·개인정보처리방침 정식 검토**(현재 사용자에겐 확정본으로 노출하나 정식 검토 전)
- [ ] 첫 거점 최종 확정 (전체 vs 한 거점 집중 — 미해결 긴장)

## Phase 1: MVP

> 선행: Phase 0의 DB 스키마(=DATA.md) 완료. 동작 명세는 SPEC.md. 여기는 작업 단위.

> **▶ mock→실 DB 전환 = 서로 독립인 2트랙 (2026-07-29 정리, 되돌리지 말 것):**
> **① 인증(로그인) — ✅ 완료(2026-07-29)**: `mock-auth` 삭제 → Supabase Auth **Google OAuth 단독**. Server Action(`login/actions.ts`) → `auth/callback/route.ts`(PKCE code 교환) → `getCurrentUser`(Supabase `getUser`, `React.cache`) → 세션 refresh·1차 차단은 `proxy.ts`. 이메일 로그인·test 계정 제거, 로그아웃은 Server Action(`signOut`, scope local). ⚠️ **`users` 테이블은 "로그인용으로는" 불필요했다** — 로그인·세션·이름/이메일은 `auth.users`가 다 준다(그래서 지금 테이블 0개로 로그인이 동작한다). **하지만 프로필 테이블 자체는 여전히 필요하다**: `church_id`·`church_verification_status` 등 교회 멤버십을 담을 곳이 없어서 지금 교회 기능이 전부 닫혀 있다(DATA §3 `users` 명세 유효). 즉 **"불필요"가 아니라 "로그인 단계에선 미뤄도 됐다"**. **카카오·네이버는 오픈 범위 밖**(2026-08-17 확정 — 구글만으로 간다). 네이버는 Supabase 기본 미지원 → 보류.
> **남은 인증 작업 1개**(admin 운영자 게이트는 2026-07-29 완료): **교회 멤버십** — `getCurrentUser`가 `churchId`/인증상태를 항상 `null`로 주므로 교회 기능 전체가 닫혀 있다(②트랙에서 교회 테이블과 함께).
> **② 데이터(공고·교회)** — JSON → Supabase 테이블. ⚠️ **핵심은 seam 전환(쉬움 — `lib/queries` 본문만)이 아니라 "데이터 유입"**: (a)크롤러 승격=검수브릿지(크롤러 스키마 확정 후) (b)교회 등록 mutation (c)seed(임시). **DB가 비면 read 전환해도 빈 화면** → 유입이 먼저. read+write는 도메인별로 함께. **실데이터는 크롤러 검수브릿지 준비 후**라, ①(로그인)을 먼저 한다.

### 1-1. 공통 골격
- [~] 도메인 타입 (`types/domain.ts`) — Job·Church·User·CurrentUser 등 **작성 완료**. ⚠️ **DATA와 어긋난 15곳이 남아 있다**(아래 별도 항목) — 그게 닫혀야 [x]
- [x] 도메인 상수·enum (`constants/`) — 교단·지역·직분·부서·고용형태 (영어 key + 한글 라벨)
- [x] 레이아웃 (헤더·푸터·모바일 네비), globals.css, 디자인 토큰

### 1-2. 공고 열람 (구직자, 로그인 불필요)
- [~] 공고 목록 (`/jobs`) — **mock UI 완료**. `'use cache'`+`cacheTag("jobs")` 서빙(`◐ PPR`). 실 데이터는 ②트랙
- [~] 검색·필터 (교단·지역·직분·부서·고용형태·자격/경력·사례비·사택) — **mock UI 완료**(`jobs-view`·`filter-jobs`·`jobs-url-state`). ⚠️ **dynamic이 아니다**: 필터는 100% 클라이언트 상태고 URL은 시드·반영만 한다. 그래서 쿼리가 달라도 서버 HTML이 같아 `/jobs`가 캐시되고 canonical도 하나다(CLAUDE.md)
- [x] ✅ **정렬 = 최신순 고정**(2026-08-17) — 사례비순·마감임박순을 **제거**했다. 인터뷰에서 나온 그대로다: *"사례비순은 빼는 게…너무 세상적. 마감임박순도 애매"*(INTERVIEWS). `SortKey` 타입까지 지워 **사용자가 고르는 정렬축이 없다**. 노출 등급(대표광고→프리미엄→일반) 우선은 유지 — 정렬 옵션이 아니라 유료 상품의 근거다. 필요해지면 그때 다시 넣는다
- [~] 공고 상세 (`/jobs/[id]`) — **mock UI 완료**. 구조화 정보 + 교회 채널 링크 + `JobPosting` JSON-LD(**모집중만**) + `BreadcrumbList`(**마감 공고도 유효해 항상 출력** — 의도된 동작) + 지도 링크. 실 데이터는 ②트랙
- [~] 교회 상세 (`/churches/[id]`) — **mock UI 완료**. 교회 정보 + 현재/지난 공고 + 갤러리 + 지도 링크. 공개는 `verification_status='APPROVED'`만(DATA §9). 교회 목록 browse는 두지 않음 — SPEC 참조

### 1-3. 운영자 도구 (admin) — manual seeding의 핵심
- [~] admin 수집 등록 도구 (`/admin/ingest`) — **mock UI 완료**(붙여넣기 → 구조화 → 프리필 폼 → 등록은 no-op). 실 등록·검수 브릿지는 크롤러 트랙(1-10)
- [~] AI 구조화 파이프라인 (`lib/ingest/`) — **키워드 휴리스틱으로 동작 중**(`structure.ts`). Claude API 호출로 교체는 Phase 1 Server Action
- [~] admin 공고 관리 (`/admin/jobs`) — **mock UI 완료**(탭·필터·테이블·행 액션·Sheet). 실 저장과 **검수중 탭 복원**은 아래 검수 큐 항목
- [~] "주인 없는 공고" 등록 — **모델 확정**: `source=OPERATOR` + **작성자 컬럼 없음**(가드레일 #2, `owner_id`는 2026-08-07 제거), 편집 권한 = 그 교회 인증 관리자. mock 89건 반영. ⏸ 실 등록(Server Action)은 크롤러 승격 트랙과 한 묶음

### 1-4. 인증 + 마이페이지 + 교회 등록 (단일 계정 모델 — DATA §3, SPEC 사용자 모델)
- [x] 로그인 (`/login`) — **Google OAuth 실동작(2026-07-29)**. 폼은 서버 렌더(JS 없이도 제출), `?next=` 복귀 + open-redirect 방어(`safeInternalPath`), 실패 시 `?error=oauth`로 안내하고 `next` 유지. 세션 쿠키 `httpOnly`+`secure`(`lib/supabase/cookie-options.ts`). 첫 로그인=가입이라 약관·개인정보 동의 고지 링크 표시. **카카오·네이버는 오픈 범위 밖**(2026-08-17). **단일 계정 = 기본 사용자**(로그인=일반 성도, 교회 담당자는 인증 문서로 승격 — 가입 시 역할 선택 없음)
- [x] 로그아웃 — Server Action(`mypage/actions.ts` `signOut`, scope local). 회원탈퇴 자동 처리는 미구현이라 운영자 문의 경로로 안내(약관·개인정보처리방침이 보장한 권리를 실제로 행사 가능하게)
- [~] 마이페이지 (`/mypage` · `/mypage/church` · `/mypage/church/info` · `/mypage/church/promote`) — **mock UI 완료**: 사역자 view(최근 본 + **북마크** + 하단 교회 CTA·계정) + 교회 대시보드(상태 탭·노출광고 사이드바·공고 행 수정/⋯마감·삭제/재등록) + 교회 정보 관리 페이지(소개·연락처·채널·사진) + **노출 결제 페이지**(PortOne V2 실결제 동작·서버 금액 검증, 1-8·4). 헤더 아바타=마이페이지 직행 + "교회 공고 등록" 상시 링크(`hasChurchAccess` 분기). 서버 배선·mutation·실 노출 적용 Phase 1
- [ ] **북마크** (`bookmarks` 테이블) + 공고 카드·상세 저장 버튼 — 단일 계정이라 **Phase 1로 이동**(원래 Phase 2). 지금은 localStorage로 동작
- [~] 교회 인증 (`/mypage/verify`) — **mock UI 완료**(상태별 화면 + 4섹션 폼: 교회 선택·증빙(고유번호증/사업자등록증 + 사무용 연락처)·담당자(실명·직분 — 이메일은 Google OAuth로 이미 검증된 `users.email`)·동의). 실 업로드·운영자 승인 Phase 1 → 인증 교회만 게재
- [~] 교회 공고 등록·수정 (`/jobs/new`, `/jobs/[id]/edit`) — **mock UI 완료**: 3스텝 위저드(모집 기본·처우·서류·지원·마감), 제출 서류 필수/선택·접수 방법·자격 프리셋 등(SPEC). '교회 직접 등록'. **인증 게이트 적용**(`hasChurchAccess` 아니면 `/mypage/verify`). 남은 Phase 1: Server Action·편집 권한=교회 인증 멤버십(owner 아님). **DATA 스키마 반영은 확정 완료**(2026-08-04, Phase 0 참조 — 폼 7필드 전부 컬럼 확보. 폼의 사택 "협의"는 `housing_provided=NULL` + `housing_note`로 매핑)
- [ ] **등록 검수 — ★ 전수 검수로 되돌림(2026-08-05 결정, 사용자 확정)**
  > **뒤집힌 결정**: 2026-07-21엔 "사전 전수 검수는 절대 안 함(1인이 다 못 봄)"으로 정하고 공고 `pending`을 뺐다. **2026-08-05에 되돌린다 — 운영자가 모든 공고를 검수한다.**
  > **왜 이제 가능한가**: 크롤러 도입(1-10)으로 **수집 공고는 이미 검수·승격이 필수**다(가드레일 #1 — 검수 없이 자동 공개 금지). 즉 물량의 대부분은 어차피 운영자 손을 거친다. 남는 건 **교회 직접 등록 공고뿐**이고 그건 소수(mock 기준 101건 중 12건)라 1인이 감당된다. `/pricing`의 "모든 공고 운영자 검수" 문구도 이 정책과 일치한다.
  - ① **교단 enum 드롭다운**(자유입력 금지) = 이단 1차 차단
  - ② **교회 인증(증빙+운영자 승인)** = 등록 자격 게이트. 그 위에 **공고 단위 검수**를 둔다: 교회가 등록 → `PENDING` → 운영자 승인 → `OPEN`
  - ③ 약관 명시(1-6) · ④ 사후 신고(2-2b)
  - **교단 정책 = 정통 화이트리스트**: 정통 교단만 enum에 둠 → 이단은 목록에 없어 자동 배제. "이단이라 뺐다" 명시·블랙리스트 **금지**(신학논쟁·명예훼손 회피), 대외는 "주요 교단 포함" 표현. 기타(ETC)는 정통 군소만, 논란 시 admin 거부.
  - `JobStatus.PENDING` = **살아있는 상태**(제거하지 말 것). 지금 코드가 이 상태를 만들지 않는 건 mutation이 아직 없어서다.
- [ ] **공고 검수 큐 복원** (위 결정의 구현) — `/admin/jobs`에 **검수중 탭 + 승인/반려**를 되살린다(2026-07-21에 제거했던 것). `/admin` 홈에 "검수 대기" 카드도. 등록 Server Action이 `status=PENDING`으로 저장하도록. 교회 화면(`/mypage/church`)엔 검수중 탭·배지 복원(현재 잔여 PENDING 배지만 있음).

### 1-5. SEO
- [x] `generateMetadata`/정적 metadata 전 페이지 · `<html lang="ko">` · **`sitemap.ts`·`robots.ts`(2026-07-30)**
- [x] 공고 상세 JobPosting JSON-LD — **모집중일 때만 출력**(마감 공고는 구글 권장대로 구조화 데이터 제거)
- [x] **중복 색인 방지 canonical**(2026-07-30) — `/jobs`의 필터·정렬·페이지 쿼리 조합이 각각 색인되면 중복이 폭발하므로 대표 URL을 `/jobs`로 고정. 홈·공고·교회 상세도 추적 쿼리(`?utm_*`) 대비 canonical 지정
- [x] `metadataBase`(`constants/site.ts` `SITE_URL`) — OG·canonical 절대 URL 기준. 프리뷰가 자기 도메인을 대표로 알리지 않도록 **env 아닌 상수**
- [x] **title 중복 해소** — `/jobs`가 root 기본 title을 상속해 홈과 같았다. 검색용 title·description 부여(홈은 root 값 = 대표 페이지라 정상)
- [x] **OG 공통값**(`SITE_OPEN_GRAPH`) — ⚠️ Next는 `openGraph`를 **통째로 교체**해서, openGraph를 재정의하는 상세 페이지는 root의 `siteName`·`locale`을 잃는다. 상수를 양쪽에서 펼쳐 써 해결(전 페이지 타입에서 5개 태그 확인)
- [x] **OG 이미지**(2026-07-30) — `app/opengraph-image.tsx`로 1200×630 브랜드 카드 생성(딥그린 + 골드 로고 + 도메인). 전 페이지 타입에서 `og:image` 1개씩 확인. `SITE_OPEN_GRAPH.images`로 지정 — ⚠️ openGraph를 재정의하는 상세 페이지는 **파일 기반 이미지도 상속받지 못하기** 때문
  - **제약(실측)**: ImageResponse는 `ttf`·`otf`·`woff`만 지원(우리 폰트는 `PretendardVariable.**woff2**` → 못 씀) + **번들 500KB 제한**. 그래서 ① **한글 미사용**(로고가 영문이라 가능) ② `fontWeight` 무효(기본 폰트 단일 두께)
  - [ ] **공고별 이미지**(제목·교회명 박힌) — 실데이터 후 검토. **한글 정적 폰트(ttf/otf) 확보가 선행**이며 500KB 안에 들어가야 한다(전체 한글 폰트는 초과 → subset 필요). 그때 굵기 문제도 함께 해결됨
- [x] **검수 반영**(2026-08-05) — OG 부속 태그 복구(`type`·`width`·`height`·`alt` — 파일 규약 우회로 사라졌던 것. 카톡·페북은 크기 없으면 첫 스크랩에서 썸네일을 놓친다) + `?v=` 캐시버스터(이미지 교체 시 카톡 캐시 무효화) + `satisfies`로 타입 검증(그냥 객체면 `images` 오타도 컴파일 통과) + 정적 4개 페이지 canonical + robots에 `/jobs/new`·`/jobs/*/edit` 추가 + 도메인 리터럴 `SITE_DOMAIN`으로 통합
> ⚠️ **Search Console 사이트맵 등록은 실 공고 데이터가 들어온 뒤에.** 코드는 준비됐지만, 등록이 곧 "가짜 공고를 색인해달라"는 요청이 된다. sitemap은 `getAllJobCards()`(모집중만)를 쓰므로 DB 전환 시 자동으로 실 공고가 반영된다 — 파일 수정 불필요(빌드 매니페스트로 확인: sitemap prerender 엔트리에 `jobs`·`churches` 태그가 전파돼 `updateTag("jobs")`가 sitemap도 갱신).
> 남은 것: 공고가 수만 건이 되면 sitemap 분할(index) · `updated_at` 생기면 `lastModified` 정교화(현재는 `postedAt`).

**▶ SEO 검수에서 남은 미해결 3건 (2026-08-05 · 실데이터 전에 처리)**
- [x] ✅ **만료된 `OPEN` 공고 — 해소**(2026-08-19 확인). 증상은 `status` 하나만 믿어 과거 `validThrough`를 계속 내보내고 sitemap이 만료 URL을 광고하던 것. ⚠️ **여기 적었던 해법(만료 `OPEN`→`CLOSED` 전환 배치)은 채택하지 않았다** — `status`는 교회의 명시적 의사표시라 시스템이 덮어쓰면 안 되고, 배치를 돌릴 운영 리소스도 없다. 대신 **파생 계산**(`isPubliclyOpen`, 위 항목)으로 숨긴다: `status`는 그대로 두고 seam이 걸러 sitemap·`JobPosting`·목록에서 빠진다
- [ ] **soft 404** — 없는 공고·교회(`/jobs/nope`)가 **HTTP 200**. PPR 셸이 먼저 나가고 `notFound()`가 `<Suspense>` 안에서 호출되기 때문(proxy 리다이렉트와 같은 제약). 지금은 Next가 `noindex`를 자동 주입해 색인은 막히나, **DB 전환 후 삭제 공고가 404/410 대신 200을 주면** Search Console에 soft 404가 쌓인다. 고치려면 PPR 셸 결정을 되돌려야 함 → 기록만
- [ ] **지역·직분 랜딩 라우트** — 노리는 키워드는 `"OO지역 전도사 청빙"`인데 **그 키워드를 받을 URL이 없다**(`/jobs?region=SEOUL`은 canonical로 `/jobs`에 흡수). 쿼리 파라미터로 facet SEO를 하려 하지 말고 **전용 라우트**(`/jobs/region/seoul` 등 자체 H1·title·canonical)를 만드는 것이 정답. ⚠️ 그때 `/jobs`의 canonical도 재검토
- [x] ✅ **저비용 보강 3종 완료**(2026-08-19 확인) — `BreadcrumbList`(공고·교회 상세 양쪽) · `Organization`(`(public)/layout.tsx`에서 공개 전 페이지) · `JobPosting.identifier`

### 1-6. 신뢰·법적 페이지
- [x] 소개 (`/about`) — 정적, footer 전용 (mock 단계 완료)
- [x] 공고 노출 안내 (`/pricing`) — 정적, 3카드(무료·프리미엄·대표광고) + 카드별 노출 미리보기 모달, 가격 공개(앵커) + 결제만 문의 (실제 광고 기능·라이브 결제는 Phase 2)
- [~] 약관·개인정보처리방침 (`/terms`, `/privacy`) — **초안 보강 완료**(약관 15조+부칙: 교회 인증·게재 기준·유료 서비스·청약철회/환불·지식재산권·사업자 정보 / 개인정보 12항: 수집·법령별 보유기간·위탁·보호책임자·권익침해 구제). **"정통 개신교 교단만·부적격 삭제"** 조항 포함(법적 방어선). 사업자정보는 `constants/business.ts` 단일 소스(사업자등록번호 165-41-01202 확정, 나머지 `[ ]`) + 푸터 표기. ⚠️ **여전히 초안** — 정식 운영 전 **법률 검토 + `[상호·대표·주소·통신판매업 신고번호]` 실값·청약철회 세부기준 확정 필수**
- [x] 문의 — 푸터 mailto (`contactMailto()`, `footer.tsx`). ⚠️ 주소는 아직 개인 메일 — 브랜드 이메일 개설 시 `constants/business.ts`만 바꾸면 된다

### 1-7. 인터뷰 반영 (누나 2026-07-02 — 타겟 사역자)
> 근거·발언 전문: [`INTERVIEWS.md`](./INTERVIEWS.md). 데이터 모델 변경은 확정 시 DATA.md로.

**도메인·데이터 (디자인보다 선행 — 카드/상세 레이아웃에 직접 영향)**
- [ ] 담당부서 재설계 — 세분화(영아·유치·유년·초등·중등·고등…) + **심방** 추가 + **공고당 복수선택** + **교단별 별칭**(감리=아동부, 통합=소년부 등; 검색·완성·표시에서 동의어 처리)
- [x] 교회 규모(대/중/소) **제거** (2026-07-02) — 기준 모호·신뢰 저하·"세상적". domain·카드·필터·상세·DATA·mock에서 삭제 완료. 규모 감(感)은 지도·건물사진으로 대체
- [x] 직분에 **담임목사 추가** (2026-07-02 결정) — 실수요 반영. 대외 포지셔닝을 **"사역자 청빙"으로 통일**(SPEC 스코프·전 카피 정리 완료), enum `SENIOR_PASTOR` 추가. 주력은 여전히 부교역자. ★ **범위 확장(2026-07-28)**: "사역자 청빙" → **개교회 채용**(사역직 MINISTRY + 일반직 GENERAL) — 1-10 참조
- [~] 사례비 — "교회 내규에 따름/면접 후 협의" UX. **등록 쪽 완료**: 폼이 프리셋 칩 + 자유 입력을 숫자(min·max)와 **동급 경로**로 두고(`job-form.tsx` `PayFields`), 표시도 `formatPay`가 `note`를 1급으로 처리한다. 남은 것은 **표시 쪽 "전면 강조 지양"**(카드·상세에서 사례비 비중 조정)
- [~] 공고 **자동 만료 정책** — 교회가 마감 갱신 안 함(기한="구할 때까지"). **핵심은 구현 완료**(위 "공개 노출 만료 규칙"): 등록 폼이 마감일을 받고 **상시모집을 1급 옵션**으로 두며(`job-form.tsx`), 상시모집은 `ALWAYS_OPEN_MAX_DAYS`(90일)로 자동 컷된다. `status` 수동 갱신에 의존하지 않는다(파생 계산). 남은 것은 90일이 실데이터에서 적절한지 확인하는 운영 판단뿐

**홈·정보구조**
- [x] 홈 스탯 **"청빙 중 교회" 제거** (2026-07-02) → 모집중·새공고 2개 (한 교회 여러 자리도 한 게시글로 인식돼 혼란)

**디자인 단계에서 반영**
- [ ] 공고 상세 레이아웃 재고 — 핵심(사례비·출근일·고용형태·마감)을 우측 sticky에만 두지 말고 **시선 흐름상 먼저·눈에 띄게** (시안 A 재고)
- [ ] 톤: "세상적" 회피(색·워딩) — 교회 시장 정서

**신규 기능 (Phase 2 성격)**
- [~] 교회 위치 **지도 연결** → 2-1에 통합. **주소→네이버 지도 링크는 완료**(2026-08-19 확인 — `naverMapUrl`, 공고 상세·교회 상세 양쪽). 지도 임베드·거리 기반 필터는 Phase 2
- [ ] 교회 **사진 업로드**(Supabase Storage) → 교회 상세 **사진 갤러리·라이트박스**(`ChurchGallery` UI 완료) 노출 — 교회 직접 등록 시만(운영자 수집분은 저작권 이슈로 제외, 포스터 이미지와 동일 논리)

> **Phase 1 완료 기준**: 공고 검색·열람 동작 + 교회 홈페이지 링크 노출 + admin으로 공고 등록 가능 + 배포됨.

**병행 트랙**
- [ ] **공고 수집 시작** — 첫 거점 공고 20~30개 수집(**크롤러 자동 수집** min_job_agent, 1-10; 사람 수집은 보완) + AI 구조화 등록 ("꽉 찬 사이트" 만들기). **거점 tier 집중 = 1군(예장합동·통합)** 우선, 2군은 들어오면 수용 (DATA enum tier)
- [ ] 시드 유저(누나)에게 베타 공유 준비

### 1-8. 배포 & 결제(PortOne + NHN KCP) 심사 — ✅ **완료(2026-08-05)** (카드 신청·PG 심사가 오래 걸려 앞당긴 트랙)
> **결과**: 전략대로 됐다. 배포 → 결제 flow 구현 → 심사 제출 → 심사 도는 동안 admin·SEO·로그인 실전환 → **가맹 심사·카드사 등록 둘 다 통과, 실카드결제 활성.** 결제 인프라 트랙은 여기서 닫는다. 남은 것은 결제가 아니라 **접근**(교회 멤버십)과 **적용**(featured 세팅·주문 저장) — 각각 1-4·Phase 1.
>
> **당시 전략(기록)**: admin 제외 기본 페이지가 mock으로 완성되면 **실 데이터/백엔드보다 먼저** 배포한다. 그다음 **PortOne 결제 flow를 먼저 구현(테스트 결제)** 해 실동작을 확보하고, 그 상태로 NHN KCP 가맹 심사를 넣는다. 심사가 도는 동안(오래 걸림) admin·데이터·백엔드·기능을 마저 다듬는다.
> **순서 확정**: 배포(07-18) → PortOne 테스트 결제(07-20) → 도메인 연결(07-20) → KCP 전자결제 신청(07-20) → PG-API·실연동 채널(07-21) → **카드사 등록신청(07-21)** → (심사 3~15일 중) admin·상세 기능·데이터.
> **PG 결정(2026-07-20, 되돌리지 말 것)**: **NHN KCP · 신용카드 일반결제 단일 채널**. 우리 BM=1회성 노출 구매라 정기결제(구독)·간편결제·본인인증 불필요. PortOne 추천패키지가 KCP+KPN·정기결제까지 동시 신청했으나 **실제 코드는 채널 1개(KCP 일반결제)만 사용** — KPN·정기결제는 미사용(무료라 방치 or 취소). 간편결제(카카오/네이버페이)는 전환율용 Phase 2 옵션.
> **KCP 결제 조건(2026-07-21, 심사 상담 안내)**: 건당 한도 **100만원** · 월 정산한도 **150만원**(부족 2~3일 전 상향요청, 보증보험료 발생) · 정산 월 4회(4·11·19·26일) · 카드 할부 3개월 제한. 우리 상품 최대 50만원(대표광고 4주)이라 **건당 여유** · 월 150만은 노출 매출 증가 시 상향요청.
> **통신판매 면제(2026-07-21)**: 훈테크=일반과세자·개업 2026-03-13(신규)라 직전연도 통신판매 거래 50건 미만 → **통신판매업 신고 면제 대상**(전자상거래법 시행령 §6). footer·약관에서 통신판매신고번호 생략 정당(카드사 심사 #3 "면제사업자 예외"). ⚠️ 연 통신판매 50건 초과 시 신고 + `business.ts` 번호 기재 필요.

순서:
1. [~] **admin 제외 기본 페이지 mock 완성** — 남은: **SEO(`sitemap.ts`·`robots.ts`)** · terms/privacy **법률 검토·`[ ]` 실값 확정**. (`/jobs/new` 인증 게이트·terms/privacy 초안 보강·취소환불 조항·사업자정보 푸터(사업자번호 165-41-01202)는 반영 완료)
2. [x] **Vercel 배포** (2026-07-18) — https://min-job.vercel.app/ · **JSON 더미 데이터 그대로**(심사용) · 커스텀 도메인 연결은 이후
3. [x] **Supabase 연결** (2026-07-19) — 클라이언트 배선 + 키(로컬·Vercel) + ping 검증. **연결만**, 데이터는 mock 유지(실 DB는 Phase 1)
4. [x] **PortOne 노출 결제 flow 구현·테스트 결제 검증** (2026-07-20, `5764fdc`) — `/mypage/church/promote`(인증 게이트) → PortOne V2 `requestPayment`(KCP CARD) → `POST /api/payments/complete` 서버 금액 재계산·실결제 조회 검증. **KCP 테스트 결제 성공.** ⚠️ 실 노출 적용·주문 저장·모바일 redirect 복귀는 Phase 1
5. [x] **도메인 연결(2026-07-20)** — `minjob.co.kr`(hosting.kr) → Vercel. hosting.kr DNS에 A `@`→216.198.79.1 + CNAME `www`→(Vercel 전용 발급) 추가. 대표주소 = **`www.minjob.co.kr`**(apex→www 308), SSL 자동. 전파 후 Valid
6. [x] **NHN KCP 전자결제 가맹 심사 — 통과(제출 2026-07-20 → 완료 2026-08-05)** — PortOne 전자결제 신청 **사전점검 6항목 전부 통과**(URL=`https://www.minjob.co.kr`, 사업자정보=전화번호 반영으로 통과) → 가맹 심사 통과 + **일반결제 계약 활성**. 심사가 본 것: 상품·가격(`/pricing`) · 이용약관 · 취소/환불 규정 · 사업자정보 표기 · 개인정보처리방침
7. [x] **PG-API 발급 + 실연동 채널 전환(2026-07-21)** — KCP PG-API(개인키+서비스 인증서) 발급 → PortOne **실연동** 채널 **"MinJob NHN KCP"**(PG Provider `kcp_v2`, 사이트코드 IP94F, PG-API 인증서/개인키 등록) 생성 → 채널 키 `channel-key-bc781263-…`를 `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`(로컬 `.env` + Vercel)에 교체·재배포. STORE_ID·`PORTONE_API_SECRET`은 동일 상점이라 불변. 라이브 결제창 = 실연동(테스트 아님)
8. [x] **카드사 등록신청 — 심사 종료(제출 2026-07-21 → 종료 2026-08-05)** — `partner.kcp.co.kr` 신용카드 일반결제 등록신청. 제출 시 기재: 심사용 계정 `test1@test.com` + 결제창 경로(`/mypage/church/promote`) + 통신판매 면제 사유. 체크 7항 통과(비회원 구매불가라 #7=아니오+계정 제공, 통신판매는 #3 면제 예외). **심사 중 걸려 있던 "URL·사업자정보·상품/가격 변경 금지" 제약 해제 → prod 배포 동결도 해제.**
   > ✅ **해소됨(2026-08-05).** 심사 중에는 로그인 실전환(2026-07-29)을 prod에 올릴 수 없었다 — 심사용 계정 `test1@test.com`이 사라지고(mock 계정 폐기) `getCurrentUser`가 교회 인증상태를 항상 `null`로 주어 심사에 기재한 결제창 경로에 아무도 도달할 수 없었기 때문. 심사가 끝나 **prod를 dev로 fast-forward했다.** 테스트 계정 잔재(`church-verifications.json` vf-005)도 합성값으로 교체 완료.
   >
   > ✅ **실카드결제 활성(2026-08-05)** — 가맹 심사(6번)·카드사 등록(8번) 둘 다 통과. 결제 인프라는 **끝났다**.
   >
   > ⚠️ **그런데 결제 경로에 아무도 도달할 수 없다** — `getCurrentUser`의 `churchVerificationStatus`가 하드코딩 `null`이라 `hasChurchAccess`가 항상 false → `/mypage/church/promote` 진입 불가. **이제 결제의 유일한 블로커는 교회 멤버십 실배선**(②트랙, 1-4). 결제 자체를 더 손댈 것은 없고, 멤버십이 붙는 순간 매출이 열린다.
   >
   > 📌 **`/pricing`의 "온라인 결제는 준비 중 — 지금은 문의로 진행해요"는 그대로 둔다**(page.tsx 63·159·256행 + CTA "문의하기"). 결제 인프라는 열렸지만 위 게이트 때문에 **실제로 아무도 온라인 결제를 할 수 없어 카피가 아직 사실이다.** 교회 멤버십이 붙어 `/mypage/church/promote`에 도달 가능해지는 시점에 이 4곳을 "바로 결제" 카피 + `/mypage/church/promote` 링크로 함께 전환할 것 — **멤버십 배선의 완료 조건에 포함**.
9. [ ] **실 데이터 + Supabase 백엔드 + 기능 상세 다듬기** → Phase 1 본체(1-1~1-7)와 합류. **심사가 끝나 더 이상 "승인 후" 대기 조건이 아니다** — 이제 여기가 주 트랙
> 더미 데이터 = JSON 유지(심사용) · 심사 위해 배포 필수 · 사업자등록·통신판매업 신고 등 행정 절차는 별도(사용자 진행).

### 1-9. 페이지별 로직·인터랙션 디테일 마감 (mock 단계 — 지금 가능)
> ⚠️ **"mock UI 완료"는 "디자인·스캐폴드 완성"이지 로직 완성이 아니다.** 페이지마다 mock 단계에서도 마땅히 동작해야 할 **프론트 로직·인터랙션 디테일에 구멍**이 있다(폼 제출·hover/토글·상태 분기·빈 상태·모바일·링크 목적지 분기 등). 데이터 채우기·백엔드 배선과 **독립적으로 지금 다듬는 갈래**. 전 페이지를 하나씩 순회하며 구멍을 식별→수정한다.
> **구분 원칙**: **B(mock에서 동작해야 할 프론트 로직) = 여기서 수정 / A(실 DB·Auth·mutation 의존) = Phase 1 배선으로 이관.** 순회 중 발견한 A는 해당 항목(1-1~1-8)에 남기고, B만 여기서 잡는다.
- [x] **공개**: `/jobs` URL 동기화(필터·검색·정렬·페이지 → URL·뒤로가기·공유·seed) · 404/error/global-error 바운더리. (`/jobs/[id]`·`/churches/[id]`·홈은 인벤토리상 B 구멍 없음)
- [x] **인증**: `/login` `?next=` 복귀(+open-redirect 방지) · `/jobs/new`·`/edit` 위저드 스텝 검증(빈 폼 제출 방지). (mypage·church 상태분기·탭·케밥은 동작, mutation은 A=Phase 1)
- [x] **admin**: 홈 카드 deep-link + featured 필터 · ingest 노트 리셋. (탭·필터·시트·케밥 동작, 승격/승인·반려는 A)
- [x] **공통**: 모바일 햄버거 네비 · admin 홈 grid 모바일. (헤더 분기·hover는 동작)
> ✅ **완료(2026-07-29)**: 위 B 구멍 마감. 겸해결=pageSize seed. 보류=pagination ellipsis(mock 소량). 회원가입/비밀번호 찾기는 **Google OAuth 전환으로 해소**(별도 가입·비밀번호 개념 자체가 없어져 "준비 중" 안내도 제거).

### 1-10. 크롤러 연동 (min_job_agent — 데이터 수집 방식 전환)
> **방향 전환(2026-07-28 확정, 법률 검토 완료).** 자매 프로젝트 `min_job_agent`가 **공개된 공식 게시판(교단·신학교)**을 자동 수집 → AI 구조화 → 검수 큐(`review_data`)에 적재한다. 운영자가 검수·승격하면 `churches`/`jobs`로 반영된다. 기존 "자동 크롤러 배제"(가드레일 #1)를 **재정의**한다 — 공개 공식 출처 한정, 영리 사이트 출처 배제는 유지, **크롤러 실운영은 법률 검토 완료가 전제(2026-07-28 확인 완료)**. staging 4테이블은 **min_job_agent 소유**(min_job은 인지만 — init.sql/마이그레이션 작성은 보류, SPEC 진화 중).
> **정본**: `../min_job_agent/docs/`(SPEC·CONTRACT·SOURCES·SNAPSHOT). ~~`CRAWLER_HANDOFF.md`~~ 는 6개 절 전부 CLAUDE.md·DATA.md·ROADMAP·SPEC에 흡수돼 **삭제됐다**(2026-08-05). 아래는 min_job 쪽 싱크 TODO.

**(a) 문서·정책 싱크**
- [x] 가드레일 #1(자동 크롤러 금지) 재정의 — 공개 공식 게시판 한정 자동 수집 허용(영리 사이트 출처 배제는 유지). CLAUDE.md·DATA.md 갱신 (완료 2026-07-29)
- [x] 가드레일 #3(연락처·PII 취급) 재정의 — 지원용 공개 연락처(contact)만 저장·공개 (완료 2026-07-29)
- [x] **범위 확장 문서화** — "사역자 청빙" → **개교회 채용**(사역직 MINISTRY + 일반직 GENERAL). SPEC/DATA/CLAUDE 스코프 카피 갱신 + 공개 카피는 크롤러 미노출 (완료 2026-07-29)

**(b) 코드·타입·enum·mock 싱크**
- [x] denomination enum에서 **KIJANG 제거 → 10키**(기장=ETC로 흡수, HAPSIN 유지). mock churches의 KIJANG 건은 ETC로 교정 (완료 2026-07-29)
- [~] jobs 신규 필드 반영 — `jobKind`(MINISTRY/GENERAL)·`role`·`contact` = `types/domain.ts`+mock 반영 **완료(2026-07-29)**. `position` NULL 허용·폼 seam·일반직 UI는 크롤러 실데이터 시(deferred), 마이그레이션 SQL 보류

**(c) admin 검수 브릿지**
- [ ] `review_data` → 승격 UI — 크롤 적재분을 운영자가 검토 후 churches/jobs로 승격(기존 `/admin/ingest`와 정합)
- [ ] **크롤 대시보드** — 수집 현황·큐 상태 admin 노출

**▶ 중복 판정: 교회 직접 등록 ↔ 크롤링 (2026-08-05 식별 · 2026-08-07 판정 주체 확정 — 구현 미착수)**
> 이미 있는 것: 크롤러 **내부** 중복은 `source_data`의 `UNIQUE(source_key, external_id)`로 막히고, 검수 브릿지는 `review_data.dedup_key`로 **후보만 제시하고 자동 병합은 안 한다**(운영자 판단). **재공고는 병합 금지**(차별점).
> **빠진 것**: 교회가 MinJob에 직접 올린 공고와, 크롤러가 그 교회 게시판 글을 수집한 공고가 **같은 공고일 때**. 출처가 달라 크롤러 내부 dedup으로 안 잡힌다.
> ⏱️ **지금 당장은 중복이 생기지 않는다** — 교회 직접 등록 mutation(Server Action)이 아직 없어 경로가 하나뿐이다. 단 **교회 등록 mutation을 만드는 그날부터 쌓이므로 그 작업과 반드시 같이 한다.**

- [ ] **판정은 크롤러 `dedup_key`를 받아 쓴다 — min_job이 따로 만들지 않는다**(2026-08-07 확정). ~~`repostKey`로 판정~~ 하려던 계획은 **무효**다: 그 함수는 제거됐고(`lib/repost-tracking.ts` 삭제 — DATA §6), 키가 `교회+직분+부서`뿐이라 **시간 축이 없어** "같은 시기에 두 경로로 올라온 중복"과 "반년 뒤 다시 올린 것"을 애초에 구별할 수 없었다. 크롤러는 `연락처+직분+부서`에 **마감일 일치·게시 간격**을 더해 이미 같은 판정을 하므로, min_job은 **그 결과(`review_data.dedup_key`)를 검수 화면에 보여주기만** 한다. 판정 신호(강→약): **마감일 일치** → 거의 확정 · 같은 자리 + **게시일 근접** → 중복 후보 · 제목·본문 유사도 / 사례비·부임시기 일치 → 보조
- [ ] **중복일 때 우선순위 = 교회 직접 등록.** 교회가 본인 조건·연락처를 직접 쓴 쪽이 정확하다. 처리: 크롤링분은 **승격하지 않고**, 기존 공고에 `source_url`(원문 링크)만 붙이고 `review_data.published_job_id`를 그 기존 공고로 기록 → 다음 크롤에서 재등장 방지(컬럼은 이미 있음). 출처 링크가 붙어 신뢰도도 오른다
- [ ] **반대 방향(더 흔할 것) — 등록 시 클레임 유도.** 크롤링 공고가 먼저 올라가 있고(`source=OPERATOR`) 그 교회가 나중에 인증해 직접 올리려는 경우, 새로 등록하면 중복이 된다. **운영자가 개입할 지점이 없다**(교회가 등록 버튼을 누르면 끝). → **`/jobs/new` 제출 직전에 그 교회의 `source=OPERATOR` 공고를 보여주고 "혹시 이 공고인가요?"** — [네, 가져와서 수정] / [아니요, 새로 등록]. 중복을 막으면서 **클레임이 자연스럽게 일어난다**(지금 클레임은 대시보드에 묻혀 있어 교회가 잘 못 찾는다).
  > 🔗 **편집 게이트와 짝**: `getEditableJob`이 `source=CHURCH`만 편집 허용하므로(2026-08-07), 교회가 운영자 공고를 수정하려면 **반드시 클레임을 거친다**. 위 유도 화면이 그 유일한 입구다.
- [ ] **교회 dedup** — 운영자 수집 시 기존 교회 수기 매칭(DATA §6). 크롤 매칭은 `matched_church_id`로 후보 제시, 자동 생성 금지
> 크롤러 **실운영은 법률 검토 완료가 전제**(2026-07-28 확인 완료). 결제(1-8)·페이지 로직 마감(1-9)은 이 트랙과 병행.

### 1-11. 코드 정리 백로그 (전체 감사 2026-08-05 — 즉시 처리분은 이미 반영)

> 전 코드베이스 감사(CLAUDE.md 룰 + 클린코드 + 스타일) 결과. **아키텍처·가드레일·Supabase 규칙·`'use cache'` 제약·PII는 전부 통과**했고, 아래는 남긴 것들이다. 감사가 "즉시"로 꼽은 것(잘못된 도메인 `minjob.kr`, 화면에 노출된 `Phase 1`, 죽은 코드, `mailto` 헬퍼 우회, 문서 캐시 계약)은 **2026-08-05에 처리 완료.**

- [x] ✅ **가격 단일 소스화 완료 (2026-08-19)** — `EXPOSURE_PRODUCTS`(원 단위)가 유일한 출처가 됐다. 요금 페이지 6곳·교회 대시보드 2곳의 한글 가격 문자열을 제거하고, 표시는 `formatExposurePrice`(`lib/format.ts`) 하나로 모았다(결제 화면의 인라인 `/10000` 나눗셈도 같은 함수로 교체). 대시보드 사이드바는 상품명까지 상수를 순회해 읽는다. ⚠️ 이게 결함이었던 이유: **금액을 계산하는 쪽**(결제 화면·서버 금액 검증 `exposurePrice()`)은 이미 상수를 읽는데 **표시하는 쪽만 문자열이었다** — 상수를 고치면 계산값과 광고 문구가 갈린다. (지금은 테스트 채널이고 교회 멤버십 미배선으로 결제 경로에 도달조차 못 하지만, 열리는 순간 드러나는 종류의 결함이다.) 상수를 임시로 바꿔 프리렌더 HTML까지 전파되는지 확인했다
- [ ] **폼 원시 요소 → `components/ui` 사용.** `pricing/page.tsx` 문의 폼 5개(`<input>`/`<select>`/`<textarea>`)가 `Input`/`NativeSelect`/`Textarea`를 재구현. `verify-form.tsx` 버튼 3개도 `Button` 대신 손으로 조립. `pricing/` 폴더만 `cn()` 대신 템플릿 리터럴 사용(다른 파일은 전부 `cn()`)
- [ ] **반복 UI 3종 추출** — 탭바(카운트 배지) 3곳 · enum→`<option>` 9곳(+`EnumSelect`/`Select` 경쟁 구현 2개) · `Field`/`Section` 래퍼가 **4벌씩** 따로 존재. `form-section.tsx`의 `Field`가 가장 풍부하니 그걸 `components/ui`로 승격
- [ ] **`mocks/index.ts`의 `as unknown as`** — 이중 캐스트가 필드 누락을 숨긴다(`qualification`이 101건 중 19건 없음). `as Job[]`만 남기면 검사가 살아난다. **mock→DB 전환 때 함께**
- [ ] **타입 경계 정리** — env `!` 6개(`requireEnv()` 헬퍼) · 결제 경로의 `as ExposureProduct`(타입 가드로) · admin view의 `as` 11개(`parseEnumParam` 하나로) · `types/domain.ts`의 `?`와 `| null` 혼용 통일
- [ ] **UI 문체 규칙 확정 후 일괄** — 제품 화면=해요체 / 약관·개인정보=합니다체로 정하고 혼용 정리(`pricing/page.tsx`는 한 답변 안에서 두 문체가 섞여 있다)
- [ ] **스켈레톤 관용구 통일** — 이름 붙인 `XxxSkeleton`(10곳) vs 인라인 한 줄(3곳). 앞의 것으로 통일(레이아웃 시프트 방지가 원래 목적). 단 `HeaderAccountFallback`의 투명 텍스트 방식은 딥그린 헤더용 **의도된 예외**
- [x] ~~`JobStatus.PENDING` 결론 내기~~ → **결론(2026-08-05): 유지.** 사용자가 전수 검수를 확정했으므로 죽은 코드가 아니라 **예비 배선**이다(1-4 결정 참조). 6곳의 분기·화면 문구도 그대로 두고, 검수 큐 구현 시 살아난다.

## Phase 2: 차별화 + 자생 전환

> 일부 기능은 DATA.md의 B 결정(거리·프리미엄 만료)에 의존.

### 2-1. 차별화 기능
- [ ] **재공고 추적 되살리기** — ⛔ 2026-08-07 제거됨(`lib/repost-tracking.ts` 삭제). **claim이 돌아 `church_id`가 채워진 뒤**가 자연스럽다. 후보 키 = `church_id + 직분 + 부서`(claim된 것만) 또는 크롤러와 같은 `연락처 + 직분 + 부서`. 조건·근거 = DATA.md §6
- [~] 거리 기반 필터 + **교회 위치 지도 연결(네이버/카카오)** — 위치·교통·전도환경 파악이 사역자 최대 관심(1-7). **링크는 Phase 1에서 완료**(`naverMapUrl`); 남은 것은 거리 기반 필터(좌표 필요)

### 2-2. 사역자 편의 (재방문 유도)
- [ ] **관심 교회 팔로우 + 새 공고 알림** (`church_follows`). (로그인·북마크는 단일 계정이라 Phase 1로 이동 = 1-4)

### 2-2b. 검수·신뢰 (교회 등록 늘면)
- [ ] **사후 신고 기능** — "이 공고 부적절 신고" 버튼(구직자가 걸러줌, 대형 플랫폼식 사후 모니터링)
- [ ] **AI 이단 스크리닝** — 교회명·주소·URL로 이단 의심 신호 **플래그만**(자동 거부 X, 최종 판단은 사람). 물량이 "손 부족"할 때 도입 — 그전엔 신규 교회 수동 확인이 더 정확. AI에게 이단 판정 위임 금지

### 2-3. 광고·노출 (수익화 — 첫 매출 채널)
> 등록은 무료, 노출이 유료. 교회가 결제하면 "더 많이·더 크게·눈에 띄는 위치"에 노출.
- [ ] **노출 상품 상세 확정** (선행) — 상품은 **프리미엄·대표광고 2종으로 진행**(끌어올리기는 저볼륨이라 제외, 기독 B2B 배너는 Phase 2+ 옵션). **상세(노출 위치·기간 단위·가격·묶음 할인·부가세·결제 수단)와 최종 확정을 여기서** 검토. 이게 돼야 `/pricing` 실제화(라이브 결제) 가능
- [ ] 노출 등급 모델 — 일반 / 프리미엄(상단 고정·강조 배지) / 대표 광고(홈·목록 상단 추천 슬롯, 더 크게)
- [ ] 노출 위치·크기·기간 차등 + 만료(`featured_until`) 자동 강등
- [ ] 정렬 반영 — 프리미엄·대표 광고 우선 노출
- [ ] 결제 초기 수동 처리 (자동 결제 연동은 Phase 3)

> **Phase 2 완료 기준**: 거리 필터 + 첫 프리미엄 노출.

**병행 트랙**
- [ ] 신학교 커뮤니티·단톡방 침투 (마케팅 1·2순위)
- [ ] SEO 유입 측정 (마케팅 3순위)
- [ ] 공고 100개 목표 달성

## Phase 3: 고도화

- [ ] **인재 DB(링크드인형)** — 사역자 프로필 등록 → 교회가 먼저 연락. `minister_profiles` 테이블 신설(계정에 1:1, "구직 중" opt-in + "제외 교회") (개인정보 동의·처리방침)
- [ ] 사이트 내 지원·서류 중개
- [ ] 공고 재등록 편의 (교회의 복붙 재게시)
- [ ] 결제 연동 (프리미엄 노출 자동 과금)
- [ ] 관심 조건 알림 (구직자) — 알림 발송·운영 부담 커 후순위
- [ ] 검색광고 (네이버·구글) — 1~3순위 채널 검증 후

## 전제 · 리스크 (계속 인지)

> 검증을 줄이기로 한 만큼, 아래를 계속 의식한다. "왜 사람이 안 오지?" 상황 시 점검 지도.

| # | 리스크 | 비고 |
|---|---|---|
| R1 | 페인이 "갈아탈 만큼" 강한가? | 인터뷰이가 처음엔 "불편 없다"고 함 |
| R2 | 누나 1명 니즈가 다수에게 공통인가? | 표본 1명, 가족 |
| R3 | 교회가 무료라도 자기 공고를 등록하러 올까? | manual seeding으로 초기 우회, 자생 전환 미검증 |
| R4 | 비공식 네트워크(교수·동문 추천) 비중이 커서 공개시장 수요가 작지 않을까? | "인맥 없는 층"이 시장 |
| R5 | 빈도 낮은 서비스의 재방문·수익 지속성 | 인재 DB로 보강 검토 |
| R6 | 프리미엄 노출에 교회가 결제할까? | 출시 후 실측 |
| R7 | 데이터 수집 법적 경계 | **변호사 검토 완료(2026-07-28)** — 크롤러 자동 수집은 공개 공식 게시판 한정·영리 사이트 출처 배제(가드레일 #1·#3 재정의) |
| R8 | 신학교 커뮤니티 인증제라 외부 홍보가 막힐 수 있음 | 시드 유저 경유 등 침투법 강구 |
