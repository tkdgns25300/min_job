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
- [ ] ⏸ **크롤러 구조화 데이터 유입 후 착수**(2026-08-16 결정 — 구조는 확정, 실데이터가 바꾸는 건 제약 임계값뿐. 신규 DB라 미루는 비용 거의 없음) 마이그레이션 — churches·church_links·church_photos·jobs·**job_promotions**·users·**bookmarks**(테이블만 먼저 만든다 — 배선 전까지 앱은 localStorage) + enum CHECK + **jobs CHECK 4개**(①직분↔직무 ②연락처≥1 ③수집공고 source_url ④교회등록 church_id) + **users CHECK 2개**(APPROVED면 church_id 필수 · REJECTED면 사유 필수) + 인덱스 + RLS (DATA.md §3·5·9). **신규 DB이므로 `ALTER`가 아니라 `CREATE TABLE`에 직접**. ⚠️ **증빙 서류용 비공개 Storage 버킷**(operator만 읽기)도 여기서 함께 만든다 — 테이블 목록에 없어 빠뜨리기 쉽다(`users.verification_doc_path`가 가리키는 곳)
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
- [x] ✅ **DB 타입 생성 — `types/database.ts` (2026-08-21)** — Supabase 자동 생성(11테이블·180컬럼 = 우리 7 + 크롤러 4). `lib/supabase/{server,service,session}.ts` 전부 `<Database>`. 검증은 파일을 역파싱해 컬럼·nullability·Insert optional 지문(md5)을 만들고 DB에서 같은 지문을 계산해 대조했다(일치). FK 12개 — DB의 13번째 `users_id_fkey`는 `auth.users`를 가리키는 cross-schema라 생성기가 제외한다.
  > **enum 컬럼은 `string`으로 온다** — DB가 `text + CHECK`라 Postgres enum 타입이 없다(§1의 의도적 선택). 좁히기는 **seam의 일**이다: `getCurrentUser`가 `church_verification_status`를 `CHURCH_VERIFICATION_STATUSES` 대조로 좁히고 모르는 값은 `null`(fail-closed)로 본다. **정합에서 만난 enum 컬럼마다 같은 처리가 필요했다.** 세 번째 호출부가 나오면 헬퍼로 뽑는다(추상화는 3번째에).
  > `churches(...)` 조인은 **객체**로 추론된다(배열 아님) — `getCurrentUser`의 `Array.isArray` 방어는 근거가 없었고 삭제했다.
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
> ⛔ **`/admin/jobs`에 "미상" 필터·카운터를 만들지 않는다 (2026-08-17 판단 철회)** — DATA §3의 *"검수에서 채울 값"*을 `/admin/jobs`로 잘못 읽고 한때 할 일로 올렸다. 그 검수는 **승격 전** 브릿지(`/admin/review` → `review_data` 보정 → 크롤러가 `jobs`로 INSERT)를 말한다. `/admin/jobs`는 **이미 공개된 공고**를 관리하는 화면이라 애초에 그 일을 하는 자리가 아니고, 미상 공고도 기본(전체) 목록에는 그대로 조회된다. 사후 수정이 필요하면 제목·교회 검색으로 찾는다.
- [x] ✅ **`pay_period` 정합 (2026-08-21 — 드리프트 1곳 해소)** — 스키마엔 `jobs.pay_period`(MONTH/YEAR)가 있는데 코드는 사례비를 **전부 월로 하드코딩**하고 있었다(`formatPay` 주석 "월 사례비", `Job.payMin` 주석 "월 사례비"). **판정과 표시를 갈라서** 닫았다 — 시간을 3층으로 다루는 규칙(DATA §6-2)과 같은 모양이다.
  - **표시는 원문 단위 그대로** — `formatPay`가 `"월 280만원"`·`"연 4,140~4,440만원"`. 월로 환산해 보여주지 **않는다**: 연봉에 상여가 섞이면 ÷12가 실제 월 지급액이 아니어서 **우리가 없는 숫자를 만든다**(DATA §3 "DEFAULT로 값을 지어내지 않는다"와 같은 이유, 가드레일 #1의 "요약 + 출처 링크" 포지셔닝). 값이 단위를 드는 이유는 **카드에 라벨이 없어서** — 없으면 `4,140만원`이 월인지 연인지 알 수 없다. 공고 상세 라벨은 `"월 사례비"` → **`"사례비"`**(라벨이 "월"을 주장하면 연 공고에서 거짓말)
  - **필터는 월로 환산해 비교** — 안 하면 연 4,140만원 공고가 "월 300 이상"에 걸린다(4140 ≥ 300). 환산 규칙을 **필터 힌트 + 활성 칩**("월 사례비 …")에 드러냈다 — 안 밝히면 결과가 버그로 보인다
  - **JSON-LD `unitText` 하드코딩 제거** — `"MONTH"` 고정이라 연 금액을 월급으로 신고해 **구글에 12배로** 노출됐다(연 4,140만원 → `41400000` + `YEAR` 확인)
  - `formatPay`가 인자 3개 → **공고 객체 하나**를 받는다(`jobRoleLine`과 같은 모양) — 인자 순서 실수가 사라지고 필드가 늘어도 시그니처가 안 흔들린다. 호출부 9곳
  - 입력 경로도 함께: `/jobs/new` 폼에 월/연 칩. (수집 쪽 주기 판정은 크롤러가 한다 — `/admin/ingest`와 `structureJobText`는 삭제됐다)
  - mock 101건에 `payPeriod` + **담임목사 연 사례비 3건을 반례로 심었다** — 전부 MONTH로 채우면 2026-08-16 교회 조인 때처럼 반례가 없어 버그가 잠복한다. mock은 `as unknown as Job[]` 캐스팅이라 **타입 검사가 이 누락을 막아주지 못한다**
  - `PAY_PERIODS` 상수가 생겨 **DB enum 컬럼 15개 전부** `constants/domain.ts`의 상수 맵과 짝이 됐다
  > ⏭ 여기서 미뤘던 사례비/급여 라벨 분기와 `role` 미표시는 **아래 일반직 항목에서 해소**했다(2026-08-21). 연 사례비 반례를 담임목사 공고로 심은 것은 그 시점에 mock에 일반직이 0건이었기 때문이다.

- [x] ✅ **`jobs.denomination` 배선 (2026-08-21 — 드리프트 1곳 해소)** — 컬럼은 2026-08-20에 만들었는데 **`types/domain.ts`에 넣지 않아** `jobChurchRef`가 계속 `church?.denomination`만 봤다. 결과: 크롤러가 교단을 판정해 보내도(`review_data.denomination` + 출처·증거) 미claim 공고는 **화면·필터에서 영구 미상**이었다 — 2026-08-16에 지역·시·주소를 공고 쪽으로 옮긴 그 작업의 마지막 조각이 빠져 있던 것이다.
  - `Job.denomination` 추가 → `jobChurchRef`가 `job.denomination`을 쓴다. `region`과 같은 규칙이고, DATA §3이 정한 *"claim 후에도 이 값을 쓴다"* 를 그대로 따른다
  - 이제 **표시값은 전부 `jobs`에서** 온다 → `jobChurchRef`의 두 번째 인자는 `Pick<Church, "id">`로 좁혔다(claim 여부·링크 대상만 교회에서 온다). 규칙 한 줄이 주석에 있다
  - mock: 미claim 14건 중 9건에 교단을 채우고 **5건은 미상으로 남겼다** — 전부 채우면 "미상 표시" 경로에 반례가 사라진다(claim된 6건도 교회 교단이 미상이라 합계 11건)
  - 검증: 미claim 공고가 교단 필터(HAPDONG 23건)·자유검색("예장합동")·상세·`getCoverageStats`에 모두 걸린다. 미상 공고는 메타줄에서 조각만 빠진다("전북 전주")

- [x] ✅ **일반직(GENERAL) 표시·검색 경로 (2026-08-21)** — DB는 `job_kind`로 사역직·일반직을 나누고 일반직 직무를 `jobs.role`(자유 텍스트)에 담는데, **그 값이 화면·검색 어디에도 쓰이지 않았다.** mock에 일반직이 0건이라 잠복해 있었다.
  - `jobRoleLine`이 **직분과 직무를 같은 자리**에 놓는다 — 사역직은 `position`, 일반직은 `role`, 혼합 공고는 둘 다("전도사 · 관리집사 · 유초등부 · 전임"). `JobCard`·`AdminJob`·`MyJob`·`PastJob`에 `role` 추가
  - **`admin-job-row`·`my-job-row`가 `jobRoleLine`을 인라인 복제**하고 있어 합쳤다 — 그대로 두면 직무가 운영자·교회 화면에만 계속 안 보였다. 세 번째 복제가 나왔으니 합칠 시점이었다(추상화는 3번째에)
  - 자유검색 haystack에 `role` 추가 — 안 넣으면 "행정간사"로 검색해도 그 공고가 안 나온다. **검색어 제안에는 넣지 않았다**(자유 텍스트라 표기가 제각각이어서 후보로 부적합)
  - `payLabel(jobKind)` — 사역직 "사례비" / 일반직 "급여"(DATA §3 `pay_min`). 혼합은 "사례비"(주력이 사역직, 둘 다 붙이면 길어진다)
  - mock에 **일반직 2건 + 혼합 1건**(job-102·103·104). CHECK ①(MINISTRY↔position · GENERAL↔role)을 데이터 생성 시 직접 검증했다. 하나는 연봉으로 뒀다 — 연 표기가 실제로 나오는 자리가 일반직이다
  - 검증: 카드 자리 한 줄 · 급여/사례비 라벨 · 직무 검색 3건 · 직분 필터에서 순수 일반직 탈락·혼합 포함 · 운영자 테이블 · 연봉 일반직의 월 환산 필터

- [ ] 🔴 **입력 경로가 `jobs`를 다 채우지 못한다 (2026-08-21 실측)** — 타입·mock 정합은 끝났지만 **사람이 값을 넣는 두 화면이 컬럼을 다 못 받는다.** 공고 등록·수정 mutation을 붙일 때 **한 묶음으로** 닫는다 — 지금 붙이면 저장할 때 값이 사라진다.
  - **`/jobs/new`·`/jobs/[id]/edit` 폼에 입력칸이 없는 컬럼 5개**
    - `job_kind` — **NOT NULL이고 CHECK ①이 `position`/`role`과 묶여 있다.** 즉 지금 폼으로는 애초에 **유효한 행을 만들 수 없다**
    - `role` — 일반직 직무. `job_kind`와 한 짝
    - `qualification` — 자격/경력 **enum**(필터축). 폼의 `qualifications`는 `requirements[]`(자유 텍스트)로 가는 별개 필드다 → 교회 등록 공고는 자격 필터에서 영구 탈락
    - `preferred` — 우대 사항. 공고 상세엔 섹션이 있는데 교회가 채울 수 없다
    - `housing_note` — 사택 비정형("사택 협의"). 사택은 제공/미제공 칩만 받는다
  - ⛔ ~~`/admin/ingest`(수집 도구)~~ — **도구 자체를 없앤다**(2026-08-21). `IngestDraft`에 연락처 4칸·`job_kind`·`role`이 없어 유효한 초안을 만들 수 없었는데, 수집원이 크롤러와 교회 등록 둘뿐이 되면서 고칠 필요가 사라졌다
  > ⚠️ **저장 시 유실이 진짜 위험이다.** 폼이 읽지 않는 필드를 그대로 저장하면 값이 `null`로 덮인다 — 크롤 공고를 교회가 claim해 수정하면 크롤러가 채운 `housing_note`·`role`·`qualification`이 사라진다. mutation은 **폼이 다루지 않는 컬럼을 건드리지 않도록** 써야 한다(부분 UPDATE).

- [ ] ⏸ **`/jobs` 사역직/일반직 필터축이 없다 (2026-08-21 발견 · 보류 결정)** — SPEC은 **"기본뷰=사역직(`job_kind @> ARRAY['MINISTRY']`), 일반직은 필터 전환, 혼합 공고는 양쪽에 다 뜬다"** 로 확정했는데(2026-07-28 운영자 확정 · SPEC §목록·§필터표) **코드에 그 축이 없다** — `FilterDim`에 `jobKind`가 없고 `JobCard`에 `jobKind`도 없다. mock에 일반직이 0건이라 안 보였고, 위 항목에서 반례를 심자 **기본 목록에 순수 일반직 2건이 그대로 섞였다.**
  > `FilterDim`(선택 없으면 전체)이 아니라 **기본값 있는 토글**이라 `includeNego`·`housingOnly`처럼 별도 필드가 맞다. 범위: `JobCard.jobKind` → mock projection → `JobFilterCriteria` → `filter-jobs` 판정 → `jobs-url-state` → `job-filter` UI → `active-filter-chips` → `jobs-view` 상태(약 7파일).
  > **언제 해야 하나**: mock엔 일반직이 2건뿐이라 지금은 티가 안 난다. **크롤러가 일반직을 보내기 시작하면 기본 목록이 오염된다** — 실데이터 유입이 마감선이다. SPEC 필터표·사이드바에 ⬜로 표시해 두었다(명세는 확정, 구현만 보류).

- [x] ✅ **정합 A·B — nullable 4개 + `description` (2026-08-21 · 5곳 해소 → 남은 11곳)**
  - **`employmentType`: `EmploymentType | null`** (원문 언급률 51%). 소비자 5곳 — `jobRoleLine` 조각 생략 · 필터 탈락(`region`과 같은 규칙) · 자유검색 · 공고 상세 `"정보 없음"`(같은 `<dl>`의 `마감일 ?? "상시모집"` 패턴 + DATA §3) · **JSON-LD는 필드를 뺀다**(구글에 빈 값·추측값을 넣지 않는다)
  - **`qualification`: `?` → `| null`** — 표시하는 화면이 없고 필터 전용이다. ⚠️ mock **19건에 키가 아예 없었다**(`?`였으니 맞았다) → 명시적 `null`로 채웠다. 캐스팅(`as unknown as Job[]`) 때문에 tsc가 못 잡는 자리다
  - **`housingProvided`: `?` → `| null`** — 🔴 **버그를 고쳤다.** 상세가 `!== undefined`로 검사해서 **`null`이 통과해 "미제공"으로 표시**됐다. DATA §3은 `null=정보 없음/협의 · false=명시적 미제공`으로 셋을 구분한다 → `!== null`로 바꿔 미상이면 줄을 뺀다
  - **`description`: `string | null` → `string`**(DB `NOT NULL`). ⚠️ 폴백을 지우지 않고 **`??` → `||`** 로 바꿨다 — null은 안 와도 **빈 문자열은 온다**(DB에 공백 CHECK 없음). `??`면 빈 설명이 메타태그·JSON-LD로 나간다. 덕분에 `jobRoleSummary`도 죽은 코드가 되지 않았다
  - **`position`은 타입을 바꾸지 않았다 — seam 정규화로 닫는다.** DB는 `text[] NULL`이지만 CHECK ①이 `coalesce(cardinality(...), 0)`이라 **NULL과 빈 배열이 같은 뜻**이고, 소비자도 구분하지 않는다(필터 `.some()` · `positionLabel([]) === ""`). `Position[] | null`로 열면 호출부가 전부 빈 상태를 두 번 검사해야 한다 → **5단계(`lib/queries` DB 전환)에서 `null → []`로 정규화**한다
  - mock 반례: 고용형태 미상 12건 · 사택 정보없음 4건(전엔 1건). ⚠️ **실측 비율(고용형태 51%)보다 낮게 잡았다** — 경로를 보이게 하는 게 목적이고 51%로 채우면 다른 검수가 시끄러워진다
  - 검증: 자리줄 조각 생략 · 고용형태·자격 필터에서 미상 탈락 · 자유검색 · JSON-LD 필드 유무 · 사택 3상태 · 빈 description 폴백

- [x] ✅ **정합 C-1 — 지원 연락처 4칸 (2026-08-21 · 4곳 해소 → 남은 7곳)** — `Job.contact` 1칸을 `contactEmail`·`contactTel`·`contactLink`·`contactPost`로 교체(`APPLY_METHODS` 닫힌 4키와 1:1). **타입·데이터만 — 화면은 C-2**.
  - ⚠️ 알고 보니 `Job.contact`는 **읽는 곳이 0곳**이고 mock 104건 전부 `null`이었다 — 지원 연락처는 **한 번도 화면에 나온 적이 없다.** 실제 지원 동선은 `getApplyTarget`의 두 갈래뿐이다(`sourceUrl` 50건 · 교회 홈페이지 8건 · 없음 1건). 그래서 C-2는 "1칸을 4칸으로 쪼개는 일"이 아니라 **연락처를 처음 화면에 붙이는 일**이다
  - mock 104건에 채웠다 — **CHECK ②가 `source_url`을 세지 않으므로 전 건에 최소 1개**가 필요하다. 조합 반례 9종(이메일만·전화만·링크만·**우편만**·4개 전부 등). ⚠️ 실제 도메인·번호를 쓰지 않는다 — 전에 mock에 넣은 도메인 17개가 살아 있는 주소였다. `recruit@<slug>.example.com` · `<지역번호>-000-nnnn` · `https://example.com/<slug>/apply`
  - **수정 폼 프리필을 고쳤다** — `toDraft`가 `job?.sourceUrl ? { LINK: sourceUrl } : {}`로 접수 방법을 채우고 있었다. 교회 공고는 `sourceUrl`이 null이라 **수정 화면이 접수 방법을 비운 채 열리고** 필수 검증에 걸려 교회가 매번 다시 입력해야 했다. 이제 저장된 4칸을 읽는다(`applyMethodsOf`)
  > ⏭ **C-2(화면) 결정 완료** — 있는 방법을 **전부** 보여주고 **우선순위로 정렬**(링크 > 이메일 > 우편 > 전화 — 앞셋은 서류 내는 경로, 전화는 대개 문의용). **클릭 동작은 만들지 않는다**(텍스트 표시). 원문 링크는 **보조**로 격하 — 사이드 카드의 `[지원하기]` 버튼을 **"원문 공고 보기"** 로 바꾸고 연락처 목록을 그 카드에 둔다.

- [x] ✅ **정합 D — 남은 7컬럼 (2026-08-21) → `types/domain.ts` ↔ `jobs` 어긋남 0** — `headcount`·`startTiming`·`housingNote`·`benefitNote`·`optionalDocs`·`processSteps`·`featuredUntil`. 셋으로 갈렸다.
  - **폼에 입력칸은 있는데 저장할 곳이 없던 5개**(`headcount`·`startTiming`·`benefitNote`·`processSteps`·`optionalDocs`) — 교회가 입력하면 버려지고 있었다(폼 주석이 그 사실을 적어뒀다). `toDraft`가 저장값을 읽는다. 제출 서류는 DB에선 배열 2개, 폼에선 항목당 `required` 플래그 하나라 옮겨 담는다
  - **표시는 있는 자리에 붙였다** — `모집 조건` dl이 **모집 인원 · 부임 시기 · 출근 · 사택 · 복리후생 · 제출 서류** 순이 됐다(몇 명을 언제부터 → 언제 일하고 무엇을 받고 → 무엇을 내야 하나). 값이 없는 줄은 사라진다 — 크롤 공고는 원문에 없는 항목이 많다
  - **사택 표기를 `housingLabel`(format.ts)로 단일화** — `null`(정보 없음/협의)·`true`·`false`가 서로 다른 값이고 비정형 표현과 합쳐 한 문장이 된다("제공 · 보증금 지원"·"사택 협의"). 둘 다 비면 `null`을 돌려 줄째 사라진다. `payNote`가 `payMin`의 짝인 것과 같은 관계다
  - **제출 서류는 필수/선택 무게를 다르게** — 선택을 같은 굵기로 쓰면 다 내야 하는 것으로 읽힌다. 필수는 본문 무게, 선택은 아래 줄 muted
  - **전형 절차는 번호 목록**(`StepList`) — 순서가 뜻을 가지므로 자격·우대의 대시 불릿과 다르다. 값 없으면 섹션째 생략, **만료 공고에도 남긴다**(행동을 유도하지 않는 정보라 지원 방법과 다르다)
  - **`featuredUntil`은 타입에만 두고 그리지 않는다** — `featuredTier`와 한 짝인 유료 노출 판정 캐시다(원장은 `job_promotions`). SPEC의 "이 페이지가 쓰는 필드" 목록에 ⬜로 명시했다
  - mock 104건에 채웠다 — 값 있음/없음을 섞고(모집인원 64/40 · 전형절차 25/79 등) 교회 등록 공고에 더 자주 넣었다. `housingProvided=null`인 4건 중 **1건은 `housingNote`도 비워** 줄이 사라지는 경로를 남겼다

- [x] ✅ **`types/domain.ts`·mock ↔ DATA.md 정합 — 완료(2026-08-21)** — 스키마 확정(2026-08-05~06)이 문서에만 반영돼 있던 상태를 닫았다. `Job`(38필드) ↔ `jobs`(43컬럼) 실측 어긋남 **0**(차이는 `id`·`created_at`·`updated_at` 3개로, 앱이 쓰지 않는다).
  - ✅ 해소 경로: nullable 4개·`description`(A·B) · 연락처 4칸(C-1) · `payPeriod` · `denomination` · 남은 7컬럼(D). `position`은 **seam 정규화**로 닫았다(타입 변경 대상 아님 — DB CHECK ①이 NULL과 빈 배열을 같게 본다)
  > **타이밍 = 마이그레이션과 한 묶음.** 초기 마이그레이션 적용·`database.ts` 생성은 **완료(2026-08-21)** → 남은 순서: `domain.ts` 정합 → mock JSON 전환 → `lib/queries` 본문 교체. **공고 등록·수정 mutation을 붙이는 시점이 이 항목의 마감선이다**(그때 `description` 모순이 런타임 에러로 터진다).
  > ⚠️ **개수는 실측으로 다시 셌다(2026-08-21)** — `Job`과 DB `jobs`(43컬럼)를 필드 단위로 대조하니 **목록에 3개가 빠져 있었다**: `qualification`·`housingProvided`(TS `?` ↔ DB NULL)·`denomination`(아예 없음). 대신 `contact`를 4개로 세어 합계만 우연히 맞아 있었다.
  > **셈 규칙**: `contact` 1개가 `contact_*` 4컬럼으로 쪼개지는 것은 **4로 센다**(그게 실제 작업량). 남은 것은 **없는 필드 7곳**뿐이다 — 엄격 4·느슨 1·연락처 4는 2026-08-21 해소.
  > ⚠️ 한때 여기 "13곳"이라 적혀 있었다 — 빠진 3개를 목록에 더하면서 헤더 총계를 고치지 않은 탓이다(2026-08-21 정정). **목록을 고치면 헤더를 다시 세라.**

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
- [~] 도메인 타입 (`types/domain.ts`) — Job·Church·User·CurrentUser 등 **작성 완료**. ✅ **DATA와 정합 완료(2026-08-21)** — 실측 어긋남 0
- [x] 도메인 상수·enum (`constants/`) — 교단·지역·직분·부서·고용형태 (영어 key + 한글 라벨)
- [x] 레이아웃 (헤더·푸터·모바일 네비), globals.css, 디자인 토큰

### 1-2. 공고 열람 (구직자, 로그인 불필요)
- [~] 공고 목록 (`/jobs`) — **mock UI 완료**. `'use cache'`+`cacheTag("jobs")` 서빙(`◐ PPR`). 실 데이터는 ②트랙
- [~] 검색·필터 (교단·지역·직분·부서·고용형태·자격/경력·사례비·사택) — **mock UI 완료**(`jobs-view`·`filter-jobs`·`jobs-url-state`). ⚠️ **dynamic이 아니다**: 필터는 100% 클라이언트 상태고 URL은 시드·반영만 한다. 그래서 쿼리가 달라도 서버 HTML이 같아 `/jobs`가 캐시되고 canonical도 하나다(CLAUDE.md)
- [x] ✅ **정렬 = 최신순 고정**(2026-08-17) — 사례비순·마감임박순을 **제거**했다. 인터뷰에서 나온 그대로다: *"사례비순은 빼는 게…너무 세상적. 마감임박순도 애매"*(INTERVIEWS). `SortKey` 타입까지 지워 **사용자가 고르는 정렬축이 없다**. 노출 등급(대표광고→프리미엄→일반) 우선은 유지 — 정렬 옵션이 아니라 유료 상품의 근거다. 필요해지면 그때 다시 넣는다
- [~] 공고 상세 (`/jobs/[id]`) — **mock UI 완료**. 구조화 정보 + 교회 채널 링크 + `JobPosting` JSON-LD(**모집중만**) + `BreadcrumbList`(**마감 공고도 유효해 항상 출력** — 의도된 동작) + 지도 링크. 실 데이터는 ②트랙
- [~] 교회 상세 (`/churches/[id]`) — **mock UI 완료**. 교회 정보 + 현재/지난 공고 + 갤러리 + 지도 링크. 공개는 `verification_status='APPROVED'`만(DATA §9). 교회 목록 browse는 두지 않음 — SPEC 참조

### 1-3. 운영자 도구 (admin) — manual seeding의 핵심
- [x] ⛔ ~~admin 수집 등록 도구 (`/admin/ingest`)~~ — **삭제 완료(2026-08-22)**. 붙여넣기 UI + `lib/ingest/structure.ts`(mock AI 휴리스틱 200줄) + 그 유일한 소비자였던 `getChurchOptions`/`ChurchOption`까지 지우고 `/admin/review`로 대체했다. 수집원이 크롤러와 교회 직접 등록 둘뿐이 되어 운영자가 직접 넣을 일이 없어졌다(가드레일 #1 개정)
- [x] ⛔ ~~AI 구조화 파이프라인 (`lib/ingest/`)~~ — **삭제 완료(2026-08-22)**. 구조화는 크롤러(min_job_agent)가 한다 — 우리 쪽에 같은 일을 하는 코드를 두지 않는다
- [~] admin 공고 관리 (`/admin/jobs`) — **mock UI 완료**(탭·필터·테이블·행 액션·Sheet). 실 저장과 **검수중 탭 복원**은 아래 검수 큐 항목
- [~] "주인 없는 공고" 등록 — **모델 확정**: `source=OPERATOR` + **작성자 컬럼 없음**(가드레일 #2, `owner_id`는 2026-08-07 제거), 편집 권한 = 그 교회 인증 관리자. mock 89건 반영. ⏸ 실 등록(Server Action)은 크롤러 승격 트랙과 한 묶음

### 1-4. 인증 + 마이페이지 + 교회 등록 (단일 계정 모델 — DATA §3, SPEC 사용자 모델)
- [x] 로그인 (`/login`) — **Google OAuth 실동작(2026-07-29)**. 폼은 서버 렌더(JS 없이도 제출), `?next=` 복귀 + open-redirect 방어(`safeInternalPath`), 실패 시 `?error=oauth`로 안내하고 `next` 유지. 세션 쿠키 `httpOnly`+`secure`(`lib/supabase/cookie-options.ts`). 첫 로그인=가입이라 약관·개인정보 동의 고지 링크 표시. **카카오·네이버는 오픈 범위 밖**(2026-08-17). **단일 계정 = 기본 사용자**(로그인=일반 성도, 교회 담당자는 인증 문서로 승격 — 가입 시 역할 선택 없음)
- [x] 로그아웃 — Server Action(`mypage/actions.ts` `signOut`, scope local). 회원탈퇴 자동 처리는 미구현이라 운영자 문의 경로로 안내(약관·개인정보처리방침이 보장한 권리를 실제로 행사 가능하게)
- [~] 마이페이지 (`/mypage` · `/mypage/church` · `/mypage/church/info` · `/mypage/church/promote`) — **mock UI 완료**: 사역자 view(최근 본 + **북마크** + 하단 교회 CTA·계정) + 교회 대시보드(상태 탭·노출광고 사이드바·공고 행 수정/⋯마감·삭제/재등록) + 교회 정보 관리 페이지(소개·연락처·채널·사진) + **노출 결제 페이지**(PortOne V2 실결제 동작·서버 금액 검증, 1-8·4). 헤더 아바타=마이페이지 직행 + "교회 공고 등록" 상시 링크(`hasChurchAccess` 분기). 서버 배선·mutation·실 노출 적용 Phase 1
- [ ] **북마크** (`bookmarks` 테이블) + 공고 카드·상세 저장 버튼 — 단일 계정이라 **Phase 1로 이동**(원래 Phase 2). 지금은 localStorage로 동작
- [~] 교회 인증 (`/mypage/verify`) — **mock UI 완료**(상태별 화면 + 4섹션 폼: 교회 선택·증빙(고유번호증/사업자등록증 + 사무용 연락처)·담당자(실명·직분 — 이메일은 Google OAuth로 이미 검증된 `users.email`)·동의). 실 업로드·운영자 승인 Phase 1 → 인증 교회만 게재
- [~] 교회 공고 등록·수정 (`/jobs/new`, `/jobs/[id]/edit`) — **mock UI 완료**: 3스텝 위저드(모집 기본·처우·서류·지원·마감), 제출 서류 필수/선택·접수 방법·자격 프리셋 등(SPEC). '교회 직접 등록'. **인증 게이트 적용**(`hasChurchAccess` 아니면 `/mypage/verify`). 남은 Phase 1: Server Action·편집 권한=교회 인증 멤버십(owner 아님). **DATA 스키마 반영은 확정 완료**(2026-08-04, Phase 0 참조 — 폼 7필드 전부 컬럼 확보. 폼의 사택 "협의"는 `housing_provided=NULL` + `housing_note`로 매핑)
- [x] ⛔ **등록 검수 — 전수 검수 철회(2026-08-21 결정, 사용자 확정). 세 번째 뒤집기이므로 근거를 남긴다.**
  > **이력**: 2026-07-21 안 함(1인이 다 못 봄) → 2026-08-05 함(전수 검수) → **2026-08-21 안 함**.
  > **오늘 근거 — 두 입력 경로가 이미 관문을 지난다.** 공고를 올릴 수 있는 사람은 **교회 인증을 통과한 관리자뿐**이고(증빙 서류 + 운영자 승인), 그 관문을 지난 교회의 공고를 또 보는 것은 이중 게이트다. 수집 공고는 `review_data`에서 이미 검수를 거친다(`medium`·`low`만 사람이 본다). 즉 "공개 전에 사람이 본다"는 요구가 **양쪽 모두 충족**돼 있다.
  > ⚠️ **2026-08-05의 근거는 그때 이미 무너져 있었다** — *"수집 공고는 이미 검수·승격이 필수(검수 없이 자동 공개 금지)"* 를 전제했는데, 2026-08-20 개정으로 크롤러가 `high`를 자동 공개한다(실측 77%). 그래서 "물량 대부분은 어차피 운영자 손을 거친다"가 성립하지 않는다.
  - ① **교단 enum 드롭다운**(자유입력 금지) = 이단 1차 차단
  - ② **교회 인증(증빙+운영자 승인)** = 등록 자격 게이트. ~~그 위에 공고 단위 검수~~ → **철회**. 교회가 등록하면 바로 `OPEN`이다
  - ③ 약관 명시(1-6) · ④ 사후 신고(2-2b)
  - **교단 정책 = 정통 화이트리스트**: 정통 교단만 enum에 둠 → 이단은 목록에 없어 자동 배제. "이단이라 뺐다" 명시·블랙리스트 **금지**(신학논쟁·명예훼손 회피), 대외는 "주요 교단 포함" 표현. 기타(ETC)는 정통 군소만, 논란 시 admin 거부.
  - `JobStatus.PENDING` = **제거됨**(2026-08-21). DB CHECK·상수·분기 8곳을 정리했고 마이그레이션은 `20260821051500`. ⚠️ **크롤러 통보 필요** — 그쪽 SPEC이 "status는 OPEN·CLOSED·PENDING 세 값"이라 적고 중복 판정에서 `PENDING` 행을 앵커에서 제외한다(값이 없어져도 깨지진 않고 그 분기가 죽는다).
- [x] ⛔ **공고 검수 큐 복원 — 철회(2026-08-21)**. `/admin/jobs`는 이미 공개된 공고를 관리하는 화면으로 남는다(검수중 탭 없음). 검수는 수집 공고 한 곳뿐이다(`review_data`). `/admin` 홈의 "검수 대기" 카드는 그쪽 건수만 센다.
  > 🔴 **함께 고친 공개 카피 2곳** — 전수 검수가 사라져 거짓이 된 문구다. `/pricing`의 **"모든 공고 운영자 검수"** → "인증된 교회만 등록"(유료 상품 페이지의 신뢰 문구라 사실인 것만 적는다), `/about`의 **"운영자가 검수·정리해"** → "정리해".

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
- [ ] 담당부서 재설계 — 세분화(영아·유치·유년·초등·중등·고등…) + **심방** 추가 + **교단별 별칭**(감리=아동부, 통합=소년부 등; 검색·완성·표시에서 동의어 처리). ⛔ ~~공고당 복수선택~~ 은 **철회됐다**(2026-08-07, 위 배열화 항목) — `department`는 단일 유지로 확정했다(다중 케이스 69건·2%대, 배열화 비용이 실익보다 크다). 이 줄에 남아 있어 한동안 확정 결정과 충돌했다(2026-08-19 정리)
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
   > 🔴 **결제 화면이 "테스트 모드 — 실제 청구는 없어요"라고 거짓 안내하고 있었다 (2026-08-19 교정).** 채널은 2026-08-05부터 실연동인데 문구·주석이 심사 시절 그대로였다. 사용자 판단으로 **결제는 잠그지 않고 열어 둔다** — 교회 인증 기능 자체가 없어 결제 경로에 **구조적으로 도달 불가**하고, 마케팅 전이라 결제할 사람도 없으며, 들어와도 이메일로 처리 가능하다. 대신 화면이 사실을 말하게 했다:
   >   - "카드가 실제로 청구돼요" + **노출 적용은 운영자 수동**(이메일 안내) + 취소·환불 문의 링크
   >   - 성공 화면에 **결제번호 노출** + **환불 기준 명시**(약관 제10조가 기준을 결제 화면에 위임한다) + **모바일은 복귀하지 않을 수 있다는 안내**
   >   - 대상 공고·결제자 이메일을 `customData`·`customer`로 **PortOne 레코드에 실어 둔다** — 주문 테이블이 없어 콘솔이 유일한 원장이고, 없으면 운영자가 *무엇을 누구에게* 적용할지 알 수 없어 수동 처리가 성립하지 않는다(+ 서버가 성공 시 감사 로그)
   >   - **청구 후 검증 실패를 `charged` 상태로 분리** — `error`와 묶으면 "결제 안 됨"으로 읽히고 버튼이 다시 열려 **실연동 채널에서 이중 청구**가 된다. 재결제 버튼 없이 결제번호·문의로 보낸다
   >
   > ⚠️ **결제를 "제대로 파는 상태"로 만들려면 3가지가 함께 가야 한다**(하나라도 빠지면 돈만 받고 못 준다): ① 주문 저장(`job_promotions` INSERT — 테이블은 2026-08-20 생성 완료, 쓰는 코드가 없다. 여기서 **REFUNDED↔CANCELLED 경계를 정한다** — 스키마 확정 때 세 값만 정해졌고 경계는 미정이다. HERO 구좌 판정이 취소된 행을 세는지가 이 정의에 달렸다) ② 노출 실적용(`featured_tier`·`featured_until`) ③ **모바일 redirect 복귀** — 지금 모바일은 `/api/payments/complete`가 **호출조차 안 된다**(복귀 파라미터를 읽는 코드 없음) → 청구만 되고 검증·화면 반영이 없다. ①②는 DB 마이그레이션과 한 묶음.
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
> **방향 전환(2026-07-28 확정, 법률 검토 완료).** 자매 프로젝트 `min_job_agent`가 **공개된 공식 게시판(교단·신학교)**을 자동 수집 → AI 구조화 → 검수 큐(`review_data`)에 적재한다. ⚠️ **2026-08-20 개정**: 확인할 것이 없는 초안은 크롤러가 `APPROVED`로 판정해 `jobs`에 직접 공개하고, `PENDING`만 운영자가 검수·승격하면 `churches`/`jobs`로 반영된다. 기존 "자동 크롤러 배제"(가드레일 #1)를 **재정의**한다 — 공개 공식 출처 한정, 영리 사이트 출처 배제는 유지, **크롤러 실운영은 법률 검토 완료가 전제(2026-07-28 확인 완료)**. staging 4테이블은 **min_job_agent 소유**(min_job은 인지만 — init.sql/마이그레이션 작성은 보류, SPEC 진화 중).
> **정본**: `../min_job_agent/docs/`(SPEC·CONTRACT·SOURCES·SNAPSHOT). ~~`CRAWLER_HANDOFF.md`~~ 는 6개 절 전부 CLAUDE.md·DATA.md·ROADMAP·SPEC에 흡수돼 **삭제됐다**(2026-08-05). 아래는 min_job 쪽 싱크 TODO.

**(a) 문서·정책 싱크**
- [x] 가드레일 #1(자동 크롤러 금지) 재정의 — 공개 공식 게시판 한정 자동 수집 허용(영리 사이트 출처 배제는 유지). CLAUDE.md·DATA.md 갱신 (완료 2026-07-29)
- [x] 가드레일 #3(연락처·PII 취급) 재정의 — 지원용 공개 연락처(contact)만 저장·공개 (완료 2026-07-29)
- [x] **범위 확장 문서화** — "사역자 청빙" → **개교회 채용**(사역직 MINISTRY + 일반직 GENERAL). SPEC/DATA/CLAUDE 스코프 카피 갱신 + 공개 카피는 크롤러 미노출 (완료 2026-07-29)

**(b) 코드·타입·enum·mock 싱크**
- [x] denomination enum에서 **KIJANG 제거 → 10키**(기장=ETC로 흡수, HAPSIN 유지). mock churches의 KIJANG 건은 ETC로 교정 (완료 2026-07-29)
- [~] jobs 신규 필드 반영 — `jobKind`(MINISTRY/GENERAL)·`role`·`contact` = `types/domain.ts`+mock 반영 **완료(2026-07-29)**. `position` NULL 허용·폼 seam·일반직 UI는 크롤러 실데이터 시(deferred), 마이그레이션 SQL 보류

**(b-2) `lib/queries` 읽기 → 실 DB (2026-08-22 완료)**
- [x] **18개 함수 전부 Supabase 쿼리로 교체 + `src/mocks/` 삭제** — jobs 12 · churches 3 · users 2 · verifications 1. **페이지 코드 0줄 변경 · 라우트 모드(`◐`/`○`) 불변**(seam을 둔 값어치가 여기서 드러났다)
  - 새 파일: `lib/queries/row-map.ts`(행 → 도메인 41필드, enum 좁히기 · queries 내부 전용) · `lib/domain-enum.ts`(`keyOf`·`keysOf`·`enumLabel` — `as keyof typeof` 캐스트를 한 곳에 가둔다)
  - `lib/job-visibility.ts`에 **`isFeaturedOn`** 추가 — `featured_until`은 mock에 없던 개념이라 그대로 옮겼으면 **기한 지난 유료 노출이 영구히 "노출중"** 이 됐다. 기한 없는 등급은 노출로 보지 않는다(fail-closed · 노출 적용 경로를 만들 때 재검토)
  - ⚠️ 지킨 규칙 셋: **공개 판정을 SQL로 옮기지 않는다**(`isPubliclyOpen`은 크롤러가 사본을 들고 있어 SQL로 쓰면 사본이 셋 — SQL은 `status='OPEN'`만 미리 거르고 판정은 JS) · **`!inner` 금지**(크롤 공고는 `church_id=NULL`이 정상이라 통째로 탈락) · **`service.ts`는 RLS 우회**라 "검수 통과 교회만"을 쿼리가 직접 건다
  - 검증: 충돌 불가능한 이름의 임시 공고 7 + 교회 2 + 임시 인증신청 2를 심어 **공개 페이지 23항목 실측 통과** 후 전부 삭제, 빈 DB에서도 확인(0건 표시·sitemap 정적 6개)
- [x] 🔴 **PostgREST 1,000행 상한 (2026-08-22 발견·수정)** — 전수 조회가 **에러 없이** 1,000행에서 잘린다(1,400행을 넣고 실측: 받은 행 1,000 · `count` 1,400 · `range(0,4999)`도 안 통함). 그대로 두면 공고 3천 건에서 `/jobs`·통계·sitemap·운영자 목록이 **조용히 1/3만** 보여줄 자리였다. `lib/queries/fetch-all.ts`로 페이지를 이어 붙이고, 정렬 마지막 키를 `id`로 고정했다(없으면 장 경계에서 행이 겹치거나 빠진다 — 2,350행으로 중복 0 확인). 적용: 공고 카드 전수 2곳 · 교회 집계 · sitemap 교회 목록 · 검수 큐 순서 · 인증 신청
- [ ] ⚠️ **전수 조회 비용 측정** — 홈 한 번에 `getListJobs`·`getJobStats`·`getSearchSuggestions`가 각각 열린 공고를 **전부** 훑는다(3천 건이면 장 3개씩). 하루 캐시라 지금은 무해하지만, 줄이려면 **공개 판정을 SQL로 내리는 것**이 유일한 길이고 그건 `isPubliclyOpen` 사본을 셋으로 만드는 결정이다(지금은 거부). 실측 후 "SQL 사본 + 두 결과를 대조하는 테스트"를 둘지 판단한다
- [ ] ⚠️ **`/jobs` payload 재검토** — 서버가 열린 공고 **전부**를 내리고 클라이언트가 거르는 설계다(CLAUDE 아키텍처 표). 3천 건에서 실측해 페이지네이션·서버 필터가 필요한지 정한다. 서버 필터를 만들면 canonical 전제도 함께 재검토
- [ ] ⚠️ **`/mypage` 북마크 서버 이전** — localStorage id 목록을 맞추려고 **만료 포함 전 공고**를 내린다. 3천 건이면 가장 무거운 페이지가 된다. `bookmarks` 테이블은 이미 있다

**(b-2) 교회 인증 체인**
- [x] **교회 인증 신청 접수 (2026-08-25)** — 화면만 있던 `/mypage/verify`에 실 배선. **판정은 운영자가 DB에서 직접** 하므로 승인·반려 액션은 만들지 않았다.
  - **교회를 고유번호로 특정한다.** 이름으로 묶는 길은 실측으로 막혀 있었다(2026-08-06: 검증 불가 67개 · 같은 연락처 다른 교회명 83건). `churches.registration_no`에 UNIQUE·NOT NULL·10자리 CHECK를 걸고(마이그레이션 `20260825063700`), 신청서가 **확인 버튼**으로 조회해 처음/기존을 가른다. ⛔ **검색창을 두지 않는다** — 표기 흔들림으로 중복 교회를 만드는 그 경로다. ⛔ **검증 상태는 응답에 싣지 않는다**(등록 여부와 이름까지).
  - **동의를 기록한다**(`verification_consent_at`·`_version` · 마이그레이션 `20260825074700`). 폼이 동의를 받는데 저장하지 않고 있었다. `users_submitted_needs_consent` CHECK가 **동의 없는 신청을 DB에서 거부**하므로 액션이 실수해도 막힌다 — 공개 방침이 약속한 것을 코드가 아니라 제약이 지킨다. 방침 문구도 함께 개정했다(보관 가능하게 · `/privacy` §1·§3).
  - **`churches.verification_status`를 2값으로 줄였다**(마이그레이션 `20260825081000`) — `REJECTED`가 `users` 쪽과 같은 이름인데 뜻이 달라 읽는 사람이 섞었고(실제로 섞였다) 기능적으로 남는 것이 없었다. 거부는 사람 쪽에만 있다.
  - **기존 교회면 교회 칸을 저장하지 않는다** — 미승인 신청자가 인증된 교회 값을 덮어쓰지 못한다. 사무용 연락처도 `users`에 담아 두고 **승인할 때 운영자가 옮긴다**. 실제로 `무시됨`·`GOSIN`·`BUSAN`을 보내 기존 행이 그대로인 것을 확인했다.
  - **재신청은 옛 서류를 지운다** — 안 지우면 파기 경로 없는 개인정보가 쌓여 방침과 어긋난다. 순서는 `업로드 → DB → 옛 파일 삭제`(먼저 지우면 DB가 없는 파일을 가리킨다). ⚠️ UPDATE는 새 값을 돌려주므로 **덮어쓰기 전에 읽어야** 옛 경로를 찾는다(내 첫 구현이 이걸 빼먹어 파일이 남았다).
  - ⚠️ **`<form action={액션}>`을 못 쓴다** — React는 폼 액션 실행 **전에** `requestFormReset`을 부르므로(react-dom `startHostTransition`) 칸별 오류를 돌려주면 **입력이 통째로 비워지고 고른 파일까지 사라진다**. `onSubmit`에서 `FormData`를 만들어 부른다. 그 대가로 **JS 없이는 제출되지 않는다** — 게이트가 확인 결과(클라이언트 상태)에 걸려 있어 어차피 성립하지 않는 경로였다. ⚠️ `"use server"` 파일은 **async 함수만 export**할 수 있어 초기값 상수를 그쪽에 두면 **빌드는 통과한 뒤 요청에서 터진다**(실측). select 3개는 "선택하세요"가 기본값 — 첫 옵션이 자동 선택되면 안 건드린 사람의 교회가 전부 `예장합동`·`서울`·`담임목사`가 된다.
  - **`experimental.serverActions.bodySizeLimit = 4.5mb`** — 기본 1MB라 그대로 두면 스캔 PDF가 대부분 거부된다. **더 올리지 않는다**: Vercel Function 본문 한도가 4.5MB고 넘으면 함수에 닿기도 전에 플랫폼이 `413`을 낸다 — 더 크게 잡으면 **로컬만 통과하고 배포에서 실패한다**. 파일 자체는 `DOC_MAX_BYTES`(4MB)로 막아 폼 나머지 칸의 여유를 둔다. 전역 설정이다.
  - **업로드는 `service.ts`** — `storage.objects`는 RLS가 항상 켜져 있고 새 버킷엔 정책이 없다(RLS 유예). 포스터 예외와 달리 **일반 사용자가 트리거하는 쓰기**라 경로에 사용자 입력을 넣지 않고(`{uid}/{uuid}.{ext}`) `upsert:false`로 막는다.
  - ⛔ **서류 없는 교회의 "운영자에게 공고 등록 요청" 샛길을 없앴다** — 고유번호증 보유 교회만 직접 등록한다는 결정을 우회했다. 자격이 없어도 **크롤 경로로 공고는 계속 공개된다**(카드·목록·필터가 쓰는 값은 전부 `jobs`에서 온다) — 못 하는 것은 셀프서비스뿐이라 커버리지 손실이 없다.
  - 검증: 순수 규칙 **46건**(정규화 표기 4종·경계·닫힌 enum 밖·전화 표기 다양성·파일 4MB 경계) + **액션을 실제 요청 안에서 실행**해 거부 5건(동의·서류·공백·자릿수·직분) · 신규 접수 · 재신청(옛 서류 삭제 확인) · 액션 가드 3건(PENDING·APPROVED·미로그인) · DB CHECK 재확인. 임시 계정·교회·서류는 전부 삭제했다.
  - **브라우저 검증(2026-08-25)** — 읽어서 맞다고 본 것과 실제로 도는 것이 다를 수 있어 Chrome으로 직접 확인했다: 고유번호 정규화·게이트 개폐·select 3개가 상수와 일치 · **5MB 파일 → 경고 + 제출 잠김**(서버에 안 감) · **서버 오류 뒤 폼 값 전부 보존**(파일 포함 · 제출 전후 비교 `identical`) · **조회 응답이 돌아오기 전에 번호를 바꾸면 그 응답을 버린다** · 콘솔 오류 0. DB 부작용 0건을 SQL로 확인. ⚠️ **성공 제출은 일부러 안 돌렸다** — 실 계정이 `PENDING`이 된다(그 경로는 위의 액션 직접 실행으로 확인).
  - ⬜ 남은 것: `/admin/verify` 판정 액션 · `churches.contact_*` 이관 · 결과 알림 메일 · 주소 검색(카카오) · 탈퇴 시 서류 파기(탈퇴 기능 자체가 없다) · 신청 이력 테이블.

**(c) admin 검수 브릿지**
- [x] `review_data` 검수 UI — **`/admin/review`**(화면 3개, 2026-08-22 완료 · **실 DB 직결**). 큐 목록(`page`+`review-queue-view`) · 단건 검수(`[id]`: 원문 열 + 편집 열 + 승격 게이트 + 판정) · 묶음 판정(`[id]/group`). seam = `lib/queries/review.ts`(캐시 안 함·snake_case 유지), 판정 = `admin/review/actions.ts`(승인·거절·저장만·되돌리기), 순수 규칙 = `lib/review-flags.ts`·`lib/review-edits.ts`. ⚠️ `churches`·`jobs`에 쓰지 않는다 — `review_status`만 바꾸고 공개는 크롤러 다음 실행이 한다
- [x] 검수 화면 재설계 (2026-08-23) — 실사용에서 나온 문제 셋을 고쳤다: 오른쪽에 결정할 게 너무 많다 · 값이 포스터와 동떨어져 보인다 · 원문이 그림이 아닐 수도 있다. **읽기 우선 값 목록**(펼쳐서 고치기) + 묶음 6개와 확인 체크 + **원문 형태별 열 너비**(그림/텍스트/못 받음) + 포스터 확대·여러 장 + **첨부 레인**(hwp·pdf는 "구조화가 안 읽었다"만 말한다) + **공개 미리보기 탭**. 색 배지는 전부 없애고 판정을 한 줄 글로 바꿨다(운영자 1인 화면에서 색은 범례를 외우게 만들 뿐이다). 고칠 수 있는 칸에 **자격·주소·목록 5칸**을 더했다 — `requirements`가 빠지면 다른 교단 지원자가 헛지원한다(크롤러 실측). 명세는 SPEC
- [x] 검수 화면 2차 손질 (2026-08-23) — 실사용 피드백 다섯: **게시판을 한글 이름으로**(`SOURCE_BOARDS` 31곳 · `PCKWORLD`로는 못 알아본다) · **"확인할 것 없음" 12% 구멍 메움**(`그림에서 읽은 값`을 빼 놨던 탓 — 크롤러 사유 대응표를 주석·테스트로 못 박았다) · **게시판 원문 프레임 토글**(누를 때만 iframe) · 묶음 화면을 알기 쉽게(제목을 건수로 · 구성원 줄은 제목 우선 · **갈리는 값을 건별로**) · 탭 라벨 정리. 겸사겸사 `ReviewForm`이 `detail` 대신 `row`만 받게 해 원문 본문이 클라이언트 payload에 실리던 것을 없앴다
- [x] 검수 화면 3차 손질 (2026-08-23) — **구획을 공개 상세와 동일하게** 맞추고 검수용 이름(누가 뽑나·어떤 자리)을 걷어냈다. **확인 체크를 값 단위로** 내렸다(`value-rows.ts`가 키·라벨·개수의 단일 소스). 판정에 **세 단계 색**(막힘·판단·참고)을 줬다 — 회색 한 줄로는 급한 것과 참고가 구별되지 않았다. **"저장만" 제거**: 판정 둘이 이미 도장을 찍고, 저장만은 판정 안 된 행을 재구조화에서 얼려 버린다. 게시판 선택지는 `키 · 이름`, 큐 꼬리 설명과 묶음 키 상자는 삭제
- [x] 원문 열 정리 (2026-08-23) — 어제 넣은 **iframe 토글을 되돌렸다**: `raw_text`가 이미 게시판 글 그대로라 96%가 같은 것을 보여주는데 건마다 보기 방식을 고르게 만들었다(실측 — PENDING 76건 중 `raw_html`에 표·목록이 있는 것 3건, 빈 것 49건). 대신 **본문을 `<pre>`에서 문단 렌더로** 바꿨다(고정폭 + 원문 빈 줄이 그대로 살아 코드처럼 보이고 두 배 길었다) · 안쪽 스크롤 제거(열 스크롤과 두 겹이었다)
- [x] 원문 누락 감사 (2026-08-23) — `source_data` 전 컬럼과 화면을 대조해 **셋이 빠져 있던 것**을 찾아 넣었다: **게시판 글 제목**(모델이 만들 수 없는 두 번째 출처 · 구조화 제목과 다르면 표시) · **`raw_meta`**(게시판 양식 값 — **CSU 13건은 교회명·교단·사례비·연락처가 전부 여기 있고 본문이 없다**. 안 보여주면 "글자로 있는 값을 그림에서 찾으라"는 화면이었다) . 겸사겸사 `ReviewRow`에서 원문·첨부를 빼 목록 payload를 줄였다(`ReviewSourceRef`/`ReviewSourceDetail`로 분리)
- [x] 원문 열 군살 제거 (2026-08-23) — 감사에서 "다 덮자"고 넣었던 **`last_structure_error`와 게시판 배관**(조회수·글번호·작성자·목록 제목/날짜·게시판 코드·미리보기)을 **다시 뺐다**: 검수와 무관하고 화면만 찼다(운영자 지적). `raw_meta`는 **공고 내용 14칸만**(`SOURCE_FORM_FIELDS`) 남겼고 `status`·`category`도 빼서, 값이 없는 게시판에서는 묶음째 사라진다. 원문 열은 이제 **제목 → 그림 → 본문 → 첨부**
- [x] 검수 화면 최종 검수 (2026-08-24) — 규칙·스타일·아키텍처·클린코드 대조. **실제 결함 4개**를 고쳤다: ① 일반직 공고에 `사례비` 라벨이 나갔다(공개 화면은 `급여` · 큐에 5건) → `payLabel` 덮어쓰기 ② 승인 게이트 문장의 조사가 틀어졌다("연락처**이** 비어") → 서버 메시지와 같은 어순 ③ **PDF 포스터에 "그림에서 읽은 값"이 붙었다** — 크롤러는 PDF를 Gemini에 보내지 않으므로 읽은 적 없는 파일을 근거로 삼는 거짓말이었다 → `imagePosters`로 판정 ④ 미리보기의 "사례비 금액" 하드코딩. 그 밖에 주석 4곳의 과장·낡음을 고치고(`ROW_COUNT` 보장은 한 방향 · actions는 두 화면 · 형태 비율 재측정 · "저장" 흔적), `ValueList`를 조합만 하게(섹션 4개 추출) · `HeadSection` 169줄을 세 덩어리로 · 죽은 export 3개 비공개 · select 캐스트를 가드로 · `Notice`를 `cn`으로 · import 순서 정리
- [x] 검수 화면 2차 검수 (2026-08-24) — **정렬 타이브레이크 불일치**를 찾아 맞췄다: 큐 목록엔 `id` 타이브레이크가 없고 앞뒤 이동(`getQueueNavigation`)엔 있어서, `created_at`이 같은 행이 생기면 "다음"이 목록과 어긋난다(크롤러가 한 트랜잭션으로 넣으면 `now()`가 고정돼 실제로 같아진다). 묶음 줄 번호도 같은 이유로 못 박았다. 묶음 화면의 **메모가 판정된 건에서도 열려 있던 것**(적어도 저장 경로가 없다)을 단건과 같게 막았다. 분해 잔여물(중복 주석) 제거. 검증: **PENDING 76 + 처리됨 25 = 101화면 전수 열기**(비정상 0 · React SSR 경고 0) + 경계값 26건(빈 행·짝 규칙·사례비 0/음수/역전·교단 UNKNOWN 왕복) + "다음" 링크가 목록 순서와 같은지 3지점
- [x] **공개 공고 관리 쓰기 배선 (2026-08-24)** — `jobs`에 쓰는 코드가 우리 앱에 **하나도 없어서**(7곳 전부 select) 문의를 받아도 손쓸 수단이 없었다. 약관은 이미 *"오류는 문의를 통해 정정합니다"*를 약속하고 있다. `/admin/jobs`에 **마감·다시 모집**, `/admin/jobs/[id]`에 **값 편집 33칸**을 붙였다.
  - ⛔ **삭제는 만들지 않았다** — 크롤러가 "공개된 job이 사라졌다"를 감지해 **다시 공개한다**(크롤러 SPEC §4.3). 내리는 수단은 마감이고, 그 사실을 화면이 말한다.
  - ⛔ **노출 설정·재등록·출처 필터를 걷어냈다** — 결제 경로에 아무도 도달할 수 없고(교회 인증 미배선), 크롤 공고의 게시일은 크롤러가 끌어올리고, 출처는 값이 하나뿐(242/242)이었다. 반대로 **내려감 탭은 유지**했다 — 상시모집 223건이 90일을 넘기면 거기 쌓이고 `/admin` 홈이 딥링크한다.
  - 편집은 별 라우트로 뒀다: 목록이 공고를 전건 로딩하는데 3천 건 × 33칸이면 payload가 5MB를 넘는다(목록 뷰가 client다).
  - 줄·구획 껍데기(`components/admin/value-row`)를 수집 검수와 **공유**하고 규칙 모듈(`lib/job-edits`)은 **분리**했다 — `jobs`의 CHECK가 다르다(교단 근거 없음·`UNKNOWN` 없음·연락처 하드 CHECK·종류 빈 배열 금지·`pay_period` NOT NULL·최소~최대 CHECK 없음).
  - 잊기 쉬운 둘을 `write()` 한 곳에 가뒀다: **`updated_at`**(트리거가 없다) · **`updateTag("jobs")`**(공개 목록이 한 시간 캐시). ⚠️ 무효화는 걸리지만 stale 창 안에서는 다른 방문자가 직전 목록을 한 번 더 볼 수 있다(실측) — 검증할 때 액션 직후 촘촘히 읽으면 계속 옛 값이 나온다.
  - **마감에 확인 단계**(2026-08-24 · `confirm-button`): **버튼이 자리를 지키며 말과 색만 바꾼다**(두 번째 누름이 실행 · 취소는 Esc·바깥 클릭). 처음엔 취소 버튼을 옆에 뒀다가 되돌렸다 — 표의 관리 칸이 좁아 줄바꿈되며 행 높이가 흔들렸다. 편집 화면은 저장과 1:1 대칭.
  - **글자까지 같던 칸을 공유로**(`components/admin/value-fields`): 사택 3상태·연락처 4칸·금액 파서가 두 value-list에 복사돼 있었다(최종 검수에서 잡음). 초안 타입 대신 값만 받게 바꿔 양쪽에서 쓰이고 계산된 키도 사라졌다. **UI 정리**: 상태를 Badge로 · 게시일을 읽기 전용 줄로(머리 줄 중복 제거) · 저장을 주 동작으로 · "고치기" 스물넷과 붉은 별의 무게를 낮춤(수집 검수에도 함께 적용).
  - 검증: 규칙 26건(경계값) + 화면 22건(뺀 것·남긴 것·딥링크·편집 구획) + 쓰기 19건(저장·마감·재개·막힌 요청이 아무것도 안 쓰는지)을 **공개에 노출되지 않는 시험 행**(마감일 지난 행)으로 확인하고 지웠다. 실 공고 6건의 `updated_at`이 토글로 움직인 것도 `created_at`으로 되돌렸다.
- [x] 검수 화면 3차 검수 (2026-08-24) — **화면이 주장하는 판정을 DB 사실과 전건 대조**했다(PENDING 76건 · DB에서 기대 판정을 독립 계산 → 불일치 0 · 판정 0건 0). **`review_data` 465건 전수 렌더**(비정상 0 · React SSR 경고 0). 고친 것: `changedEdits` 주석이 "운영자가 손댄 칸만 쓴다"고 **과장**하고 있었다 — 실제 비교 대상은 저장 직전에 다시 읽은 행이라, 창을 열어 둔 사이 크롤러가 바꾼 칸은 **운영자가 본 값으로 되돌아간다**(그게 맞는 동작이다: 사람이 본 적 없는 값을 공개하면 이 화면이 존재하는 이유가 사라진다). 이름을 아직 안 넣은 게시판이 `KEY · KEY`로 보이던 것도 고쳤다. 진행률 분모는 이제 **화면의 체크박스 수와 스스로 대조**한다(하드코딩 제거). 확인만 하고 남긴 것: 큐 페이지 payload 563KB(`/admin/jobs` 1MB와 같은 급 · 상한 100이 있어 규모가 늘어도 안 커진다)
- [x] **운영자 홈 수집 카드 손질 (2026-08-25)** — 재설계 직후 실사용에서 나온 둘을 고쳤다.
  - **색이 하루 대부분 켜져 있었다** — "오늘 돌렸나"로 갈랐는데 수집이 전부 저녁(17:01~22:16)에 돌아서 **자정부터 저녁까지 매일 18~20시간이 금색**이었다. 색이 상시면 처리할 일의 초록까지 같이 안 보인다. **한 주기(`DAILY_CRAWL_HOURS` = 24시간)를 넘겼나**로 바꿨다(아침 7시 데일리로 자동화하면 거른 날에만 켜진다). ⚠️ 처음엔 "임계값을 만들지 않는다"며 이 방식을 거부했는데 **그 규칙이 너무 넓었다**: 진짜 규칙은 "크롤러가 이미 내리는 판정을 베끼지 않는다"이고, **"어제 실행이 아예 없었다"는 크롤러가 답할 수 없는 질문**이다(프로세스가 안 뜨면 아무것도 기록하지 않는다). 베낄 원본이 없으니 사본 문제도 없다.
  - **"1곳 실패"만 말하고 어디인지 안 알려줬다** — 실패한 게시판 키는 `crawl_run.error_detail`에 있고 우리가 이미 읽는 행이다. 이름은 사실이지 판정이 아니라 붙였다(`boardLabel` · 셋부터는 "외 N"). ⚠️ `_aborted`는 게시판이 아니라 **실행이 끊긴 것**이라 뺀다(크롤러도 실패 수에서 뺀다). 순서는 jsonb가 정한다(요청마다 같다 · 실측).
  - 겸사겸사 **공개 대기 금색을 그 칸으로 좁혔다** — 카드째 물들어 옆의 공개 중·내려감까지 봐야 할 것처럼 보였다.
  - **검수에서 같은 실패가 폭만 줄어 남아 있던 것을 잡았다(2차)** — 24시간에 **여유가 0**이라 어제보다 늦게 돌린 날은 그 차이만큼 아무 이상 없이 금색이었다(실측 편차 17:01~22:16). 근거로 든 "하루 한 번 일정"도 아직 없다 — 크롤러에 `.github/`가 없고 07:00 cron은 그쪽 ROADMAP 1-7에 미착수다. 상수를 `CRAWL_OVERDUE_HOURS`로 세우고 **값은 주기 한 번(24)으로 확정했다**(운영자 2026-08-25) — 여유를 한 주기 주면 크롤러가 죽어도 이틀 뒤에야 표시되므로, 손으로 돌리는 동안 늦게 돌린 날에 금색이 뜨는 것을 감수하고 **거른 날을 그날 안에 아는 쪽**을 골랐다. 07:00 cron이 올라오면 흔들림 자체가 사라진다. 상수도 `domain.ts`에서 **`constants/review.ts`(크롤러 소유 값)로 옮겼다** — 그 파일 머리말이 "우리 도메인 enum처럼 보이면 우리가 값을 정하게 된다"고 이미 경고하고 있었다.
  - **중단된 실행이 "전부 성공"으로 나가고 있었다** — 크롤러는 예외를 잡고 실행을 닫으므로 `finished_at`이 채워지고, `sources_ok`는 손대지 않은 게시판까지 센다(`전체 - 실패`). 3번째 게시판에서 죽어도 "게시판 31곳 성공"이었다. seam이 `aborted`를 따로 넘기고 그때는 **"실행이 중단됨"만** 말한다. (커밋된 부분부터 있던 왜곡이다)
  - **실패 게시판 이름을 이름순으로 정렬**했다 — jsonb는 키를 **길이 먼저** 정렬해 저장해서, 둘만 보여주는 이 화면에서는 짧은 키(`BU`·`CSU`)가 늘 나오고 긴 키는 늘 "외 N"에 숨었다. 크롤러 `_print_errors`는 `sorted()`라 **같은 실행을 두 화면이 다른 이름으로 부르고** 있었다.
  - 그 밖에 낡은 주석 넷: `format.ts`가 "오늘 것인가를 묻는 함수"라고 스스로를 설명하고 있었고(그 질문은 경과 시간으로 옮겨갔다) · `Tone` 예시 둘 · `CrawlCard`와 `RunResult`에 같은 경고 중복 · 스켈레톤이 픽셀을 단언(실패 게시판 이름이 붙으면 좁은 화면에서 두 줄이 된다).
  - 검증: 실 seam으로 `error_detail` 파싱 5건(`_aborted` 제외 · 객체가 아닐 때 · 여러 곳 · 없음 · 동률 타이브레이커, 임시 실행 행을 넣고 지웠다) + **카드 11상태 렌더**(24시간 경계 23:59/24:01 · 이름 없는 실패 · 색 범위) + 실 화면(어제 18:04 = 색 없음 · "1곳 실패 — 횃불트리니티 Job Posting").

- [x] **운영자 홈 재설계 (2026-08-25)** — 옛 홈은 카드 넷(노출중 0·이번 주 240·내려감 0·전체 261)이 전부 **규모**였고, 운영자가 매일 보는 유일한 숫자인 **검수 대기가 화면에 없었다**. 세 카드로 다시 짰다: 처리할 일(검수·인증 큐 + 가장 오래된 건) · 수집(마지막 실행) · 공개(공개 중·내려감·공개 대기 + 새로고침).
  - **크롤 경보를 만들지 않았다** — 시안 1차에서 "게시판 2회 연속 실패" 같은 판정 상자를 그렸다가 되돌렸다. 크롤러에 이미 `pipeline/health.py::alerts_for`(연속 실패 2 · 빈 목록 2 · 죽음 3시간)와 `minjob-ingest status`가 있고, 우리가 임계값을 한 벌 더 쓰면 두 화면이 다른 말을 하게 된다. 화면은 **저장된 사실만** 그리고 판정은 그 명령을 가리킨다. 진짜 구멍은 경보가 아니라 **"할 일 없음"과 "며칠째 안 돌렸음"이 웹에서 구별되지 않는 것**이었고, 마지막 실행 시각 한 줄로 닫혔다.
  - **크기를 평상시에 맞췄다** — 79건은 백필 1회의 잔고다. 정상 유입은 하루 35건 중 검수 3건(08-24 실측). 시안 1차의 30px 숫자와 큰 카드 두 장은 0~3에 맞지 않았다.
  - **사이드바 배지도 되돌렸다** — 시안 1차가 달았는데 기존 결정 위반이고(`admin-sidebar` 주석), 셸에 캐시 못 하는 값을 넣으면 `/admin/jobs`의 `○`까지 잃으며, 같은 숫자를 한 화면에 두 번 그린다.
  - **`/admin` `○` → `◐`** — 다섯 조회 중 넷이 캐시 불가. 대가로 **페이지 게이트가 생겼다**(그동안 proxy가 유일한 관문이었다 · 2단 방어의 예외가 하나 줄었다). `/admin/jobs`는 `○` 유지.
  - ⛔ **뺀 것**: 노출중(유료)(261/261이 `NONE` · 결제 배선 전까지 영구 0) · 이번 주 등록(백필 부산물) · 전체 공고(액션 없음). 그 카드가 `/admin/jobs` **노출 필터**의 유일한 딥링크였으므로 필터도 함께 걷었다(출처 필터와 같은 판단) → `EnumFilterSelect`의 `extraOptions`도 쓰는 곳이 없어져 제거하고 제네릭을 `"all" | K`로 좁혔다.
  - 새로 생긴 것: `lib/queries/crawl.ts`(읽기 전용 seam) · `formatKstDayTime`(오늘/어제/N일 전) · `getPendingSummary`(건수+가장 오래된 건을 한 쿼리로 — `getPendingCount` 대체) · `getPublishBacklogCount` · `getVerificationQueueSummary`(숫자 둘 때문에 PII 전체를 읽지 않는다).
  - **최종 검수에서 표시값 둘이 크롤러의 뜻과 달랐다** — 둘 다 크롤러 소스와 대조해 고쳤다. ① **"게시판 N곳 모두 정상"**: `sources_ok`는 *예외를 던지지 않은* 게시판 수일 뿐이라(`cli.py` `len(sources)-len(failed_keys)`) **목록을 0행 받은 게시판이 거기 포함된다** — 그건 `status_for`가 `EMPTY`로 적고 두 번 연속이면 `LISTING_EMPTY` 경보가 나는 상태다. 크롤러가 경보를 띄우는 순간에 우리 화면이 "모두 정상"이라고 반대말을 할 수 있었다 → 크롤러 CLI와 같은 단어(**성공/실패**)로 맞췄다. ② **"새 공고 N건"**: `new_count`는 새로 저장된 **원문(`source_data`) 행 수**(`saved_total`)로 구조화·검수·공개 이전 숫자인데, 같은 카드의 "공개 대기" 옆에서 "공고가 N건 올라갔다"로 읽혔다 → **"새로 수집"**. ③ 인증 큐 요약이 `/admin/verify` 목록과 조건이 갈려 있었다(`churches!inner` 누락 · `status`가 `NULL`인 신청 처리) → 필터와 상태 판정(`applicationStatus`)을 **목록과 공유**하게 고쳤다. 그 밖에 `admin/layout.tsx`의 접근 통제 주석("3개 페이지는 페이지 게이트가 없다")이 이 변경으로 거짓이 돼 정정했다.
  - 검증: 규칙 13건(KST 자정 경계·7일 경계·미래 시각·깨진 값) + **카드 4상태 전건 렌더**(평상시·빈 큐·신호·수집 기록 없음 · 31항목) + 실 데이터 대조(검수 79·가장 오래된 건 2일 전 21:46·마지막 수집 어제 18:04·29/30·공개 261·내려감 0·공개 대기 0을 DB 독립 조회와 1:1) + 접근 판정 3종(미로그인→로그인 · 로그인만→홈 · 운영자→200) + 새로고침 Server Action 3종.

- [x] **admin 파일 배치 정리 (2026-08-24)** — `components/admin/`에 **한 라우트 전용 파일 넷**이 올라가 있었다(`admin-sidebar`=admin 셸만 · `verification-row`·`verification-sheet`=`/admin/verify`만 · `review-row`=`/admin/review/**`만). 원인은 배치 규칙의 *"두 곳 이상에서 쓰면 `components/`"* 를 **파일 수**로 읽은 것 — 한 기능 안에서 페이지 셋이 나눠 쓰면 파일은 셋이지만 기능은 하나다. 넷을 각 라우트 폴더로 내리고(`app/admin/`·`app/admin/verify/`·`app/admin/review/`) 규칙을 **라우트 기능 수** 기준으로 고쳐 적었다. 이제 `components/admin/`에는 **검수와 공고 관리가 둘 다 쓰는 셋**(`value-row`·`value-fields`·`confirm-button`)만 남는다. 동작 변경 없음(import 경로만) — 라우트 모드 `○`/`◐` 그대로

- [x] 원문 열 마무리 (2026-08-23) — **PDF 포스터가 깨진 그림으로 나오던 것**을 고쳤다(운영자 발견): `poster_paths`에 PDF가 섞여 오는데(실측 jpg 75·png 10·pdf 1) `<img>`로 그리고 있었다 → seam이 `kind`를 정하고 PDF는 브라우저 보기 도구로, 모르는 형식은 링크로. **게시판 양식 값을 본문 안으로 합쳤다** — 별 상자로 두니 메타 정보처럼 보였는데, 실은 같은 원문이 칸으로 온 것이다(양식이 있는 15건 중 11건은 본문도 함께 있어 둘 다 그린다). `sourceShape`도 양식 값을 글로 센다
  - 남은 것: 키보드 단축키·일괄 거절(둘 다 실제 큐가 쌓이는 것을 보고 판단) · 배열 칸은 읽기 전용으로 확정(SPEC)
  - ⚠️ **RLS 유예의 사정거리를 확인했다(2026-08-22)**: `public` 전 테이블에 RLS가 꺼져 있고 `anon`/`authenticated`에 전 권한이 있다 → **publishable 키만 있으면 누구나 `jobs`·`review_data`를 읽고 쓸 수 있다.** 검수 화면이 첫 실 DB 쓰기 경로가 됐으니 RLS는 실 데이터 공개 전에 반드시 닫는다(1-9)
  - ⚠️ `storage.objects`는 RLS가 항상 켜져 있고 `postings` 버킷엔 정책이 없다 → 포스터 signed URL만 `service.ts`로 만든다(CLAUDE.md Supabase 규칙의 예외 1개)
- [ ] **크롤 대시보드** — 수집 현황·큐 상태 admin 노출

**▶ 중복 판정: 교회 직접 등록 ↔ 크롤링 (2026-08-05 식별 · 2026-08-07 판정 주체 확정 — 구현 미착수)**
> 이미 있는 것: 크롤러 **내부** 중복은 `source_data`의 `UNIQUE(source_key, external_id)`로 막히고, 검수 브릿지는 `review_data.dedup_key`로 **후보만 제시하고 자동 병합은 안 한다**(운영자 판단). **재공고는 병합 금지**(차별점).
> **빠진 것**: 교회가 MinJob에 직접 올린 공고와, 크롤러가 그 교회 게시판 글을 수집한 공고가 **같은 공고일 때**. 출처가 달라 크롤러 내부 dedup으로 안 잡힌다.
> ⏱️ **지금 당장은 중복이 생기지 않는다** — 교회 직접 등록 mutation(Server Action)이 아직 없어 경로가 하나뿐이다. 단 **교회 등록 mutation을 만드는 그날부터 쌓이므로 그 작업과 반드시 같이 한다.**

- [ ] **판정은 크롤러 `dedup_key`를 받아 쓴다 — min_job이 따로 만들지 않는다**(2026-08-07 확정). ~~`repostKey`로 판정~~ 하려던 계획은 **무효**다: 그 함수는 제거됐고(`lib/repost-tracking.ts` 삭제 — DATA §6), 키가 `교회+직분+부서`뿐이라 **시간 축이 없어** "같은 시기에 두 경로로 올라온 중복"과 "반년 뒤 다시 올린 것"을 애초에 구별할 수 없었다. 크롤러는 `연락처+직분+부서`에 **마감일 일치·게시 간격**을 더해 이미 같은 판정을 하므로, min_job은 **그 결과(`review_data.dedup_key`)를 검수 화면에 보여주기만** 한다. 판정 신호(강→약): **마감일 일치** → 거의 확정 · 같은 자리 + **게시일 근접** → 중복 후보 · 제목·본문 유사도 / 사례비·부임시기 일치 → 보조
- [ ] **중복일 때 우선순위 = 교회 직접 등록.** 교회가 본인 조건·연락처를 직접 쓴 쪽이 정확하다. 처리: 크롤링분은 **승격하지 않고**, 기존 공고에 `source_url`(원문 링크)만 붙이고 `review_data.published_job_id`를 그 기존 공고로 기록 → 다음 크롤에서 재등장 방지(컬럼은 이미 있음). 출처 링크가 붙어 신뢰도도 오른다
- [ ] **반대 방향(더 흔할 것) — 등록 시 클레임 유도.** 크롤링 공고가 먼저 올라가 있고(`source=OPERATOR`) 그 교회가 나중에 인증해 직접 올리려는 경우, 새로 등록하면 중복이 된다. **운영자가 개입할 지점이 없다**(교회가 등록 버튼을 누르면 끝). → **`/jobs/new` 제출 직전에 그 교회의 `source=OPERATOR` 공고를 보여주고 "혹시 이 공고인가요?"** — [네, 가져와서 수정] / [아니요, 새로 등록]. 중복을 막으면서 **클레임이 자연스럽게 일어난다**(지금 클레임은 대시보드에 묻혀 있어 교회가 잘 못 찾는다).
  > 🔗 **편집 게이트와 짝**: `getEditableJob`이 `source=CHURCH`만 편집 허용하므로(2026-08-07), 교회가 운영자 공고를 수정하려면 **반드시 클레임을 거친다**. 위 유도 화면이 그 유일한 입구다.
- [ ] **교회 dedup** — 운영자가 사람 수집분을 등록할 때 기존 교회를 수기 매칭. ⛔ 크롤 공고는 **교회 매칭을 아예 하지 않는다**(2026-08-06 · `church_id=NULL`, claim 때 연결). `review_data.matched_church_id`는 크롤러가 채우지 않아 항상 NULL이다
> 크롤러 **실운영은 법률 검토 완료가 전제**(2026-07-28 확인 완료). 결제(1-8)·페이지 로직 마감(1-9)은 이 트랙과 병행.

### 1-11. 코드 정리 백로그 (전체 감사 2026-08-05 — 즉시 처리분은 이미 반영)

> 전 코드베이스 감사(CLAUDE.md 룰 + 클린코드 + 스타일) 결과. **아키텍처·가드레일·Supabase 규칙·`'use cache'` 제약·PII는 전부 통과**했고, 아래는 남긴 것들이다. 감사가 "즉시"로 꼽은 것(잘못된 도메인 `minjob.kr`, 화면에 노출된 `Phase 1`, 죽은 코드, `mailto` 헬퍼 우회, 문서 캐시 계약)은 **2026-08-05에 처리 완료.**

- [x] ✅ **가격 단일 소스화 완료 (2026-08-19)** — `EXPOSURE_PRODUCTS`(원 단위)가 유일한 출처가 됐다. 요금 페이지 6곳·교회 대시보드 2곳의 한글 가격 문자열을 제거하고, 표시는 `formatExposurePrice`(`lib/format.ts`) 하나로 모았다(결제 화면의 인라인 `/10000` 나눗셈도 같은 함수로 교체). 대시보드 사이드바는 상품명까지 상수를 순회해 읽는다. ⚠️ 이게 결함이었던 이유: **금액을 계산하는 쪽**(결제 화면·서버 금액 검증 `exposurePrice()`)은 이미 상수를 읽는데 **표시하는 쪽만 문자열이었다** — 상수를 고치면 계산값과 광고 문구가 갈린다. (채널은 실연동이라 청구가 실제로 되지만, 교회 멤버십 미배선으로 결제 경로에 도달조차 못 해 아직 드러나지 않았다.) 상수를 임시로 바꿔 프리렌더 HTML까지 전파되는지 확인했다
- [ ] **폼 원시 요소 → `components/ui` 사용.** `pricing/page.tsx` 문의 폼 5개(`<input>`/`<select>`/`<textarea>`)가 `Input`/`NativeSelect`/`Textarea`를 재구현. `verify-form.tsx` 버튼 3개도 `Button` 대신 손으로 조립. `pricing/` 폴더만 `cn()` 대신 템플릿 리터럴 사용(다른 파일은 전부 `cn()`)
- [x] ✅ **반복 UI 3종 추출 완료 (2026-08-19)** — 셋 다 했다:
  - `Field` **4벌 → `components/field.tsx` 1벌**(사용처 48곳). `form-section.tsx`는 `Field`만 남아 이름이 이미 거짓이라 삭제
  - 탭바 **3벌 → `components/tab-bar.tsx` 1벌**(key 타입이 화면마다 달라 제네릭)
  - 필터 select **6벌 → `components/enum-filter-select.tsx` 1벌**(`"○○ 전체"` + 라벨 맵 전개). 호출부마다 있던 `as` 캐스트도 컴포넌트 한 곳으로 모았다. 노출 필터의 `"유료노출만"`처럼 enum 밖 선택지는 `extraOptions`로 받는다
  - **`Field`는 컨트롤이 하나면 `<label>`로 감싸고**(호출부 40곳이 id 없이 이름을 얻는다), 여럿이면 `group` prop으로 `role="group"`+`aria-labelledby`가 된다(8곳 — 사례비 min·max, 칩 셀렉트, 자체 `<label>`을 가진 파일 업로드). 처음엔 전부 `<div role="group">`으로 갔다가 **단일 컨트롤 13곳이 접근성 이름을 잃는 걸** 검수에서 잡아 되돌렸다 — 그룹 라벨은 개별 컨트롤의 이름이 되지 못한다. 덤으로 `verify-form`의 **중첩 `<label>`**(잘못된 HTML)이 해소됐다.
  - ⚠️ 시각 변화: `verify-form` 라벨 12→14px · `ingest-view` 라벨 muted→foreground(대비 향상) · 운영자 탭 패딩 `px-3 py-2`→`px-3.5 py-2.5`. `ingest-view`는 옛 래퍼의 `flex gap-1.5`·`text-sm`이 사라져 간격 2곳·`~` 글자 크기가 틀어졌던 것을 명시 클래스로 되살렸다.
  - ⚠️ `components/ui`가 아니라 `components/` 루트다 — CLAUDE.md가 `ui/`를 **shadcn 원본 전용**으로 못박아 뒀다(`relative-time.tsx` 선례).
  - ⛔ **제외**: 폼 `Section` 2벌(번호 스텝 vs 제목 그룹으로 **의미가 다르다**) · `EnumSelect`/`Select` 2벌(controlled/uncontrolled 차이라 병합이 동작 변경이 된다). 둘 다 CLAUDE.md "추상화는 3번째에" 기준 미달. 표시 전용 `Section`·`InfoRow`(`job-detail-view`·`verification-sheet`)는 애초에 입력 폼과 다른 개념이라 대상이 아니다
- [ ] **`mocks/index.ts`의 `as unknown as`** — 이중 캐스트가 필드 누락을 숨긴다(`qualification`이 101건 중 19건 없음). `as Job[]`만 남기면 검사가 살아난다. **mock→DB 전환 때 함께**
- [ ] **타입 경계 정리** — env `!` 6개(`requireEnv()` 헬퍼) · 결제 경로의 `as ExposureProduct`(타입 가드로) · admin view의 `as` 11개(`parseEnumParam` 하나로) · `types/domain.ts`의 `?`와 `| null` 혼용 통일
- [ ] **UI 문체 규칙 확정 후 일괄** — 제품 화면=해요체 / 약관·개인정보=합니다체로 정하고 혼용 정리(`pricing/page.tsx`는 한 답변 안에서 두 문체가 섞여 있다)
- [ ] **스켈레톤 관용구 통일** — 이름 붙인 `XxxSkeleton`(10곳) vs 인라인 한 줄(3곳). 앞의 것으로 통일(레이아웃 시프트 방지가 원래 목적). 단 `HeaderAccountFallback`의 투명 텍스트 방식은 딥그린 헤더용 **의도된 예외**
- [x] ~~`JobStatus.PENDING` 결론 내기~~ → **최종(2026-08-21): 제거.** 2026-08-05엔 "전수 검수용 예비 배선"으로 유지했는데 그 전수 검수가 철회됐다. DB CHECK·`JOB_STATUSES`·분기 8곳 정리 완료(마이그레이션 `20260821051500`).

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
- [~] 결제 초기 수동 처리 (자동 결제 연동은 Phase 3) — **이게 현재 실제 운영 모델이다**: 카드는 실제 청구되고, 노출 적용·취소는 운영자가 PortOne 콘솔을 보고 처리해 이메일로 안내한다. 결제 화면이 그 사실과 결제번호·문의 경로를 밝힌다(2026-08-19). 자동화(주문 저장·`featured` 적용·모바일 복귀)는 1-8의 3가지.

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
