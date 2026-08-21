# DATA.md — MinJob 데이터 설계

> **DB 스키마·enum·인덱스·RLS·구조화 정책·설계 결정**. 비즈니스 동작은 [`SPEC.md`](./SPEC.md), 아키텍처·컨벤션은 [`../CLAUDE.md`](../CLAUDE.md), 작업은 [`ROADMAP.md`](./ROADMAP.md).
>
> 이 문서는 **스키마 정본**이다. 마이그레이션·DB 타입 생성은 이 문서를 따른다.
> 마이그레이션은 `supabase/migrations/`(Supabase CLI 관례 `YYYYMMDDHHmmss_name.sql`). **적용된 파일은 고치지 않는다 — 변경은 항상 새 파일이다**(고치면 파일과 실제 DB가 어긋나 재현이 깨진다).
> · `20260820231650_init.sql` — 테이블 7개 + 제약 + 인덱스
> · `20260820234934_source_url_not_blank.sql` — CHECK ⑤
> 둘 다 **원격 적용 완료**(2026-08-20 · MCP로 테이블 7·컬럼 88·CHECK 25·FK 8·인덱스 30 확인). ⬜ **RLS 정책·Storage 버킷은 아직 없다** — 다음 마이그레이션이다(RLS는 당분간 유예 — §9). **GRANT는 쓰지 않는다** — 크롤러가 service role로 붙어 우회한다(§9). (mock: `src/mocks/*.json`, 타입: `src/types/domain.ts`(화면이 쓰는 모양)·`src/types/database.ts`(**DB 행의 모양** — 자동 생성, 2026-08-21), enum: `src/constants/domain.ts`)
>
> ⚠️ **살아있는 문서.** 페이지 디자인·기능을 고도화하며 필드가 늘면 이 문서·mock 스키마를 **함께 확장**한다. 데이터는 `lib/queries/*`(seam)로만 접근해 mock↔DB 전환 시 페이지 불변.

---

## 1. 설계 원칙

- **DB는 저장 전용.** trigger·custom function·복잡한 default expression 만들지 않는다. ID 발급·timestamp·집계 등 로직은 전부 Server Action / query 함수. 내장 기능만 사용(`gen_random_uuid()`, `CHECK`, `FK`, array/`jsonb`).
- **정규화 유지 (JOIN).** 교회 속성은 `churches`에 두고 필요할 때 JOIN한다. 비정규화(공고에 교회 속성 복사) 안 함 — 우리 규모(초기 수백~수천)에선 JOIN + `'use cache'` 캐시로 충분. (대규모 인덱스 최적화 필요 시 나중에 재검토)
  - ⚠️ **명시적 예외 3개**
    1. **`jobs.region`·`jobs.denomination`** — 캐시된 쿼리가 JOIN 없이 **필터**해야 한다. `church_id`가 NULL일 수 있어 JOIN이 성립 안 함(§3). 교단은 2026-08-20 추가 — 없으면 크롤 공고가 교단 필터에서 전부 탈락한다
    2. **`jobs.featured_tier`·`featured_until`** — 원장은 `job_promotions`, 이건 `now()` 없이 읽는 현재 유효 노출 캐시(§7)
    3. **`jobs.church_name`·`city`·`address`**(2026-08-06·08-17) — `church_id`가 NULL이면 **조인 상대가 없어 보여줄 출처가 없다**. 필터축이 아니라 표시·지도용이다(§3)

    예외를 늘릴 때는 이 세 근거 중 하나에 해당하는지 확인할 것.
- **enum = 영어 대문자 key + 한글 라벨.** key는 DB에 저장(값)·URL params에 사용, 표시는 `constants/domain.ts`의 한글 라벨 맵. DB에서는 `CHECK` 제약으로 허용값 강제(별도 enum 타입 대신 `text + CHECK`로 확장 용이하게).
- **컬럼명 = `snake_case`** (DB), 앱(TS)은 `camelCase`. Supabase 생성 타입이 매핑.
- **가드레일 준수**: 공고에 작성자 컬럼 없음(권한=교회 인증 관리자) · **지원용 공개 연락처(`contact_email`·`contact_tel`·`contact_link`·`contact_post`)만 저장·공개**(지원과 무관한 제3자 개인정보 X — 가드레일 #3 갱신 2026-07-28) · source로 출처 구분 · **수집 = 크롤러(공개 공식 게시판) + 사람 붙여넣기 → AI 구조화 → 리뷰 큐 → 공개**. ⚠️ **사람 게이트는 `PENDING`에만 있다**(가드레일 #1 개정 2026-08-20) — 확인할 것이 없는 초안은 크롤러가 `APPROVED`로 판정해 **`jobs`에 직접 INSERT**한다(§10·§12).

---

## 2. enum 허용값 (`text + CHECK`)

| enum | 컬럼 | 허용값(key) |
|---|---|---|
| **denomination** (교단) | `churches.denomination` · **`jobs.denomination`** | HAPDONG · TONGHAP · BAEKSEOK · GOSIN · HAPSIN · GAMLI · SEONGGYUL · BAPTIST · SUNBOK · ETC · `NULL`(=미상·무소속) (10키 = 9대형 + 기타. **기장=ETC** — 미상을 ETC에 넣지 말 것) |
| **region** (광역) | `churches.region` · **`jobs.region`** | SEOUL · GYEONGGI · INCHEON · GANGWON · CHUNGBUK · CHUNGNAM · DAEJEON · SEJONG · GYEONGBUK · GYEONGNAM · DAEGU · ULSAN · BUSAN · JEONBUK · JEONNAM · GWANGJU · JEJU · OVERSEAS · `NULL`(=미상, 원문 명시 81%) |
| **church_channel** (채널) | `church_links.type` | HOMEPAGE · YOUTUBE · INSTAGRAM · FACEBOOK · BAND · ETC(기타) |
| **job_kind** (직군) | `jobs.job_kind` **`text[]`** | MINISTRY(사역직) · GENERAL(일반직) — 개교회 채용 구분. **배열**: 한 글에 두 종류가 섞인 공고("교육전도사 2명 · 관리직원 1명")를 표현하려면 필요. 빈 배열 금지(CHECK ①) |
| **position** (직분) | `jobs.position` **`text[]`** | SENIOR_PASTOR · ASSOCIATE_PASTOR · EVANGELIST · LICENSED_MINISTER · ETC. **배열**: 한 자리에 여러 직분 자격을 열어둔 공고("전임사역자(전도사, 강도사, 목사)")가 **826건**이라 대표 1개만 담으면 나머지로 검색한 사람에게 안 보인다. `job_kind`에 MINISTRY가 없으면 NULL (CHECK ①) |
| **department** (부서) | `jobs.department` | INFANT · CHILDREN · YOUTH · YOUNG_ADULT · DISTRICT · WORSHIP · ADMIN · ETC · `NULL` |
| **employment_type** (고용형태) | `jobs.employment_type` | FULL_TIME · SEMI_FULL_TIME · PART_TIME · `NULL`(=미상, 원문 언급률 51%) |
| **qualification** (자격/경력) | `jobs.qualification` | ANY · ENTRY · EXPERIENCED · ORDAINED · SEMINARIAN · `NULL`(=무관) |
| **pay_period** (사례비·급여 기간) | `jobs.pay_period` | MONTH(기본) · YEAR |
| **job_status** | `jobs.status` | OPEN(기본) · CLOSED · **PENDING**(검수중 — 전수 검수 결정 2026-08-05로 예약. 마이그레이션 CHECK에 반드시 포함할 것) |
| **job_source** (출처) | `jobs.source` | OPERATOR · CHURCH |
| **featured_tier** (노출) | `jobs.featured_tier` | NONE(기본) · PREMIUM · HERO(=대표광고) |
| **verification_status** (인증 상태) | `users.church_verification_status` · **`churches.verification_status`** | PENDING · APPROVED · REJECTED. `users`는 `NULL`(=미신청) 허용, `churches`는 NOT NULL(행을 만드는 쪽이 항상 상태를 정한다 — §3). **두 컬럼은 다른 사실이다** — `users`=이 사람이 그 교회 관리자로 인정됐나, `churches`=이 교회가 검증됐나 |

> **역할 enum 없음**: 모든 계정은 기본 **사역자(MINISTER)**. 교회(CHURCH)는 저장된 role이 아니라 **인증으로 열리는 view/능력**(§3 users). MINISTER/CHURCH는 화면 라벨.

> **job_kind = 최상위 축**: 개교회 채용을 사역직(MINISTRY)/일반직(GENERAL)로 가른다. 사역직은 `position`·`department`로, 일반직은 자유 텍스트 `role`로 세분(§3). 기본뷰=사역직, 일반직은 필터.
> **직교화 원칙**: 직분(position)·부서(department)·고용형태(employment_type)는 분리된 축(주로 MINISTRY에 적용). "전임전도사·교육전도사"처럼 섞지 않는다 → 모순 데이터(파트+전임) 불가능.
> **확장**: 값 추가는 `constants/domain.ts` enum + DB `CHECK`만 수정(마이그레이션 1줄). 교단은 개신교 전 교단으로 확장 가능, 초기 거점 = 예장합동·통합.

---

## 3. 테이블

### `churches` — 교회
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK, `gen_random_uuid()` | |
| `name` | text NOT NULL | 교회명 |
| `denomination` | text **NULL** (CHECK) | 교단. **NULL = 미상 또는 무소속·독립교회.** `ETC`와 구분할 것 — `ETC`는 "소속은 있고 우리 9키에 없는 교단"(기장 등)이라 미상을 섞으면 필터·거점 판정이 오염된다 |
| `region` | text **NULL** (CHECK) | 광역 (필터). **NULL = 미상** (실측 원문 명시 81%). ⚠️ NULL이면 **지역 필터에서 무조건 탈락**해 사실상 안 보이는 공고가 된다 — 검수에서 교단보다 먼저 채울 값 |
| `city` | text NULL | 시·군·구 (표시용 자유 텍스트) |
| `address` | text NULL | 주소 **원문 그대로** — 도로명/지번을 나누지 않는다(지도 검색은 둘 다 되고, 나누면 어느 체계인지 판별하는 일이 늘고 오분류가 생긴다). 교회 상세 지도가 쓴다 |
| `founded_year` | int NULL | 창립 연도 |
| `verification_status` | text **NOT NULL** DEFAULT 'PENDING' (CHECK) | **이 교회가 검증됐나.** 행이 생기는 경로는 **하나뿐이다**: **교회 인증 신청에서 신규 교회로 적어낸 순간** → `PENDING`(운영자 승인 시 `APPROVED`). 신청서에 적힌 교회명·교단·지역을 담을 곳이 `users`에 없으므로 **행을 먼저 만들어 `users.church_id`로 가리킨다**. ⚠️ **크롤 공고는 교회 행을 만들지 않는다**(§10) — `church_id=NULL`로 들어가고, 교회가 claim할 때 이미 있는 행에 연결된다. DEFAULT가 `'PENDING'`인 건 상태를 정하지 않고 만든 행을 **비공개 쪽으로 넘어뜨리기 위해서다**(fail-closed). 반려해도 행은 `PENDING`으로 남는다 — 공개되지 않고, 재신청이 같은 행을 다시 쓴다. `REJECTED`는 이미 공개된 교회를 허위 판명·opt-out으로 **내릴 때**. 공개 조회는 `APPROVED`만(§9) |
| `contact_email` | text NULL | **사무용** 이메일. 인증 검수 때 **공개 게시판 공고(`jobs.contact_email`)·홈페이지와 대조**하는 근거. 승인 후엔 교회 대표 연락처로 그대로 남아 교회 정보 관리(`/mypage/church/info`)에서 수정한다. ⚠️ **공개 화면에는 렌더하지 않는다** — 검수 대조용으로 받은 값이라 지금은 교회 상세에 노출하지 않는다(공개하려면 수집 고지부터 다시 본다) |
| `contact_tel` | text NULL | 〃 사무용 전화. 공고에 전화만 공개된 교회가 흔해 대조 수단이 하나뿐이면 못 맞춘다 |
| `created_at` | timestamptz DEFAULT now() | |

### `church_links` — 교회 채널 (1 church : N links)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `church_id` | uuid **NOT NULL** FK→churches ON DELETE CASCADE | |
| `type` | text NOT NULL (CHECK: church_channel) | HOMEPAGE·YOUTUBE·… |
| `url` | text NOT NULL | |
| — | UNIQUE(`church_id`, `type`) | 채널당 1개 |

> 앱 타입은 `Church.links: {type, url}[]`. 표시 전용 집합이라 채널 타입별 교차 조회 없음 → 정규화 테이블로 무결성 확보. (jsonb 컬럼도 대안이나 CHECK·정렬 관리 위해 테이블 채택)

### `church_photos` — 교회 사진 (1 church : N, 순서 있음)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `church_id` | uuid **NOT NULL** FK→churches ON DELETE CASCADE | |
| `url` | text NOT NULL | Supabase Storage 업로드 URL (Phase 1) |
| `sort_order` | int NOT NULL DEFAULT 0 | 표시 순서 오름차순 — 최소값이 커버 |

> 앱 타입은 `Church.photos: string[]` (sort_order 오름차순 URL 목록, 첫 장 = 커버). 사진 없으면 빈 배열 → 딥그린 기본 커버. 교회 상세 라이트박스는 client 컴포넌트(`ChurchGallery`), 실 업로드는 Phase 1(Storage). 채널과 같은 "표시 전용 집합"이라 정규화 테이블.

### `jobs` — 공고 (핵심)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `church_id` | uuid **NULL** FK→churches | 소속 교회. **NULL = 아직 어느 교회인지 확정 못 함**(크롤링 공고 기본값). 교회가 가입·인증 후 **claim하면 채워진다** → 그때 교회 상세가 켜진다. ⚠️ 자동 매칭 금지. **NULL은 `source='OPERATOR'`일 때만 가능** — 교회 직접 등록(`CHURCH`)은 인증 관리자만 할 수 있어 `church_id`가 반드시 있다 → `CHECK (source = 'OPERATOR' OR church_id IS NOT NULL)` |
| `church_name` | text **NOT NULL** | **공고가 말한 교회명 그대로**(§1 예외). `church_id`가 NULL이어도 화면에 교회를 표시할 수 있게 하는 값. 교회 직접 등록 시엔 교회 프로필에서 복사 |
| `denomination` | text NULL (CHECK) | **공고 시점에 파악한 교단** — ⚠️ **의도적 비정규화**(§1 예외 1 · 2026-08-20 추가). `region`과 근거가 같다: 교단은 **필터축**인데 `church_id`가 NULL이면 `churches`를 JOIN할 수 없어 크롤 공고 전부가 교단 필터에서 탈락한다(거점이 예장합동·통합이라 1급 축이다). 크롤러가 `review_data.denomination`을 그대로 넘긴다. **NULL=미상**(원문 명시율 실측 2.8%) · claim 후에도 이 값을 쓴다(교회 것과 다를 수 있으면 `churches`가 정본) |
| `region` | text NULL (CHECK) | **공고 시점에 파악한 광역** — ⚠️ **의도적 비정규화**(§1 예외). `church_id`가 NULL이면 `churches`를 JOIN할 수 없어 지역 필터가 통째로 죽는다. 필터·정렬은 이 컬럼을 쓴다 |
| `city` | text NULL | 시·군·구 (표시용 자유 텍스트). ⚠️ **의도적 비정규화**(§1 예외 3) — `church_id`가 NULL이면 보여줄 출처가 없다 |
| `address` | text NULL | 주소 **원문 그대로**(도로명/지번 안 나눔). ⚠️ **의도적 비정규화**(§1 예외 3). 지도가 쓴다. ⚠️ **`contact_post`와 다른 값이다** — 이건 **교회 위치**, 그건 **접수처**(교회는 부산인데 접수처가 노회 사무실일 수 있다). 섞으면 지도가 접수처를 짚는다 |
| `title` | text NOT NULL | |
| `job_kind` | **text[]** NOT NULL (CHECK) | MINISTRY(사역직)/GENERAL(일반직). **배열** — 혼합 공고 표현용(§ 여러 자리 판정 규칙) |
| `position` | **text[]** NULL (CHECK) | 직분. **배열 — 자리 수·자격 범위를 전부 담는다**(§ 여러 자리 판정 규칙). `job_kind`에 MINISTRY가 있으면 비어 있을 수 없다(CHECK ①) |
| `role` | text NULL | 일반직 직무(**자유 텍스트 · 통제 목록 아님**): 방송·미디어·행정·시설 등. **단일 유지** — 통제 목록이 아니라 필터 축이 아니고, "방송·행정"을 한 문자열로 쓸 수 있다. `job_kind`에 GENERAL이 있으면 필수(CHECK ①) |
| `department` | text NULL (CHECK) | 부서 |
| `employment_type` | text **NULL** (CHECK) | 고용형태. **NULL=미상** — 원문 언급률 51%뿐이라 NOT NULL이면 승격 시 임의값 강요 |
| `qualification` | text NULL (CHECK) | 자격/경력 요건 (필터). NULL=무관 |
| `headcount` | text NULL | 모집 인원 **+ 자리 구성 원문 보존**. **int 아님** — "약간명"·"1~2명" 같은 비정형이 흔함. 한 글에 여러 자리가 있으면 원문("1.부목사(전임) 2.교육목사 3.여전도사")을 **그대로** 담는다 → **Phase 2에서 자리별로 나눌 때 이 값이 근거**가 된다 |
| `start_timing` | text NULL | 부임 시기 — "즉시"·"협의"·"2월 중" 비정형 |
| `housing_provided` | boolean **NULL** | 사택 (필터). **NULL=정보 없음/협의 · true=제공 · false=명시적 미제공** |
| `housing_note` | text NULL | 사택 비정형 표현("사택 협의"·"보증금 지원") — `pay_note`와 동일 역할 |
| `pay_min` | int NULL | 월/연 금액, **만원 단위**. 화면 라벨은 `job_kind`로 분기(MINISTRY="사례비" / GENERAL="급여") |
| `pay_max` | int NULL | |
| `pay_note` | text NULL | 비정형 표현("내규에 따름"·"면담 후 결정") 보존 |
| `pay_period` | text NOT NULL DEFAULT 'MONTH' (CHECK) | MONTH/YEAR |
| `benefit_note` | text NULL | 그 외 처우 비고(4대보험·교육비·안식월 등 자유 텍스트) |
| `status` | text NOT NULL DEFAULT 'OPEN' (CHECK) | OPEN/CLOSED |
| `source` | text NOT NULL (CHECK) | OPERATOR/CHURCH |
| `source_url` | text NULL | 원문 링크(운영자 수집). 재호스팅 대신 링크. **`source='OPERATOR'`면 필수** — 수집물은 공개 게시판에서 오므로 원문이 반드시 있고, 가드레일 #1이 "요약 + 출처 링크"를 요구한다 → `CHECK (source = 'CHURCH' OR source_url IS NOT NULL)` |
| `contact_email` | text NULL | **지원용 공개 연락처** — 이메일 |
| `contact_tel` | text NULL | 〃 전화 |
| `contact_link` | text NULL | 〃 홈페이지·지원 양식 링크 |
| `contact_post` | text NULL | 〃 우편·방문 **접수처** 주소. ⚠️ 교회 위치(`address`)와 다를 수 있다 — 지도는 `address`를 쓴다 |
| `work_days` | text NULL | 출근 요일·시간(자유 텍스트) |
| `requirements` | text[] DEFAULT '{}' | 자격요건 항목 |
| `preferred` | text[] DEFAULT '{}' | 우대사항 항목 |
| `required_docs` | text[] DEFAULT '{}' | 제출 서류 — **필수** |
| `optional_docs` | text[] DEFAULT '{}' | 제출 서류 — **선택**. 배열 2개로 분리(jsonb `{name,required}`보다 쿼리·표시 단순) |
| `process_steps` | text[] DEFAULT '{}' | 전형 절차(서류→면접→설교…). `requirements`와 동일 패턴 |
| `description` | text **NOT NULL** | 본문(운영자 요약 or 교회 작성 — 원문 통째 복제 X). **요약이 없으면 출처 링크만 있는 빈 껍데기**가 되어 가드레일 #1("요약 + 출처 링크")과 제품의 존재 이유를 부정한다 |
| `featured_tier` | text NOT NULL DEFAULT 'NONE' (CHECK) | 노출 등급 — **현재 유효 노출의 비정규화 캐시**(원장은 `job_promotions`). 결제 완료 시 **route handler `/api/payments/complete`**가 쓴다(Server Action이 아니다 — 결제 검증은 CLAUDE.md가 허용한 REST 예외 ②). 아직 미구현 |
| `featured_until` | date NULL | 노출 만료일 — 〃. 만료 판정은 §6-1과 같은 경로(seam이 `todayInSeoul()` 생성) |
| `posted_at` | date **NOT NULL** | 게시일. **필수 복귀(2026-08-14)** — 8/5에 nullable로 풀었다가 되돌렸다(크롤러도 필수로 확정). `fetched_at`으로 대체 금지(틀린 날짜 공개) — 게시판이 날짜를 안 주는 공고(PCKWORLD 60건)는 **검수에서 운영자가 입력**한다(포스터에 대개 적혀 있다). **상시모집 만료 판정의 기준일**이기도 하다(§공개 노출 규칙) |
| `deadline` | date NULL | 마감(NULL=상시모집) |
| `created_at` | timestamptz DEFAULT now() | |
| `updated_at` | timestamptz DEFAULT now() | Server Action에서 갱신 |

#### `jobs` 테이블 CHECK 제약 (**5개**)

```sql
-- ① job_kind ↔ position/role 상호 일치 (biconditional)
--    "사역직이 있으면 직분이 있고, 없으면 직분도 없다" — XOR보다 강하다(양방향 차단).
--    혼합 공고({MINISTRY,GENERAL} + position + role)도 이 형태라야 표현된다.
--
-- ⚠️ array_length 쓰지 말 것 — 빈 배열 '{}'에 NULL을 반환하는데,
--    Postgres CHECK는 결과가 FALSE일 때만 거부하고 **NULL은 통과**시킨다.
--    → array_length 로 쓰면 "직분 없는 사역직 공고"가 그대로 들어온다.
--    cardinality 는 빈 배열에 0을 준다. 배열 자체가 NULL일 수 있어 COALESCE를 한 겹 더.
--    (실 Postgres 8케이스 검증 완료 — min_job_agent, 2026-08-07)
CHECK (
      COALESCE(cardinality(job_kind), 0) > 0
  AND ('MINISTRY' = ANY(job_kind)) = COALESCE(cardinality(position) > 0, false)
  AND ('GENERAL'  = ANY(job_kind)) = (role IS NOT NULL)
)

-- ② 연락처 최소 1개 — "어디로 지원하나"를 알 수 없는 공고는 공개할 값이 없다.
--    ⚠️ source_url은 세지 않는다 (아래 근거)
CHECK ( contact_email IS NOT NULL OR contact_tel  IS NOT NULL
     OR contact_link  IS NOT NULL OR contact_post IS NOT NULL )

-- ③ 수집 공고엔 원문 링크가 반드시 있다 — 가드레일 #1이 "요약 + 출처 링크"를 요구한다.
--    교회 직접 등록(CHURCH)은 원문이 없으므로 면제.
CHECK ( source = 'CHURCH' OR source_url IS NOT NULL )

-- ④ 교회가 직접 올린 공고엔 교회 행이 반드시 있다 — 인증 관리자만 등록할 수 있으므로.
--    수집 공고(OPERATOR)는 church_id가 NULL이다(교회 행을 만들지 않는다 · §10).
CHECK ( source = 'OPERATOR' OR church_id IS NOT NULL )

-- ⑤ source_url이 **빈 문자열이면 거부**한다(2026-08-20 추가).
--    ③은 NULL만 막는다 — 빈 문자열은 NULL이 아니라 통과했고, 그러면 수집 공고가
--    **출처 없이 공개된다**(가드레일 #1의 "요약 + 출처 링크"가 무너진다).
--    화면도 끊긴다: `getApplyTarget`이 `if (job.sourceUrl)`로 판정하는데 빈 문자열은
--    JS falsy라 지나가고, 크롤 공고는 church_id가 NULL이라 홈페이지 폴백도 없다
--    → **지원 동선이 사라진 공고**가 조용히 공개된다.
CHECK ( source_url IS NULL OR length(btrim(source_url)) > 0 )
```

> ⚠️ **③④는 한때 컬럼 설명 안에만 흩어져 있었다**(2026-08-20 여기로 모음) — 헤더가 "2개"라 적혀 있어 마이그레이션이 둘을 빠뜨릴 자리였다. 승격 게이트로는 세지 않는다(크롤 데이터에선 항상 참): §3 "최소 조건" 절 참조.

**②에서 `source_url`을 뺀 이유(2026-08-05 확정)**: 세면 크롤링 공고는 `source_url`이 항상 있어 **CHECK가 항상 참 = 장식**이 된다. 빼면 제약이 두 경로에서 각각 일한다 — 크롤링은 연락처를 못 뽑으면 승격이 막혀 **운영자가 원문·포스터를 열어 입력**하게 되고(데이터 품질 상승), 교회 직접 등록은 `source_url`이 NULL이라 자동으로 연락처가 필수다. 연락처를 별도 테이블로 쪼개지 않은 덕에 이 제약이 CHECK 하나로 가능하다(행 간 제약이면 trigger가 필요하고 DB Policy가 금지).

> **막히는 양은 크지 않다(크롤러 실측 3,181건).** 연락 수단 0종이 160건(5.0%)이지만 그 내역이 — 포스터 이미지에 연락처가 있는 것 79건(구조화가 이미지를 읽으면 채워짐) · **"청빙 완료되었습니다" 인사글 등 비채용 글 다수**(크롤러 게이트1에서 탈락, 애초에 승격 후보 아님) · 완전히 빈 공고 3건(`description`이 비어 6번에서 막힘). **승격 후보인데 연락처가 없는 공고는 실제로 극소수다.**

①의 동작:

| `job_kind` | `position` | `role` | |
|---|---|---|---|
| `{MINISTRY}` | 있음 | NULL | ✅ |
| `{GENERAL}` | NULL/`{}` | 있음 | ✅ |
| `{MINISTRY,GENERAL}` | 있음 | 있음 | ✅ **혼합 공고** |
| `{}` 또는 NULL | — | — | ⛔ |
| `{MINISTRY}` | 없음 | — | ⛔ 사역직인데 직분 없음 |
| `{GENERAL}` | 있음 | — | ⛔ 일반직인데 직분 박힘 |

직분이 안 적힌 사역직 공고(*"교역자 청빙"*)는 `POSITIONS.ETC`로 넣는다 — "기타 직분"과 "직분 미상"이 합쳐지지만, 전수 검수 전제라 운영자가 판단을 강제당하는 게 낫다고 봤다.

#### 한 글에 여러 자리가 있을 때 — 필드별 판정 규칙 (2026-08-07 확정)

게시판 글 하나에 자리가 여럿인 경우가 흔하다. **판단 기준은 "자리가 몇 개냐"가 아니라 필드마다 "이 칸의 값이 하나로 정해지냐"다.**

```
그 칸의 값이 공고에 적혀 있나?
├─ 아니오          → NULL      "모른다"        ← 자리 수와 무관
└─ 예 → 자리마다 다른가?
        ├─ 아니오  → 채운다                    ← 자리가 4개여도 채운다
        └─ 예      → NULL      "하나를 고르면 거짓이 된다"
```

**자리 수가 영향을 주는 칸은 `job_kind`·`position`(배열) · `headcount`(원문 보존) 셋뿐이다.** 나머지는 위 두 질문으로만 판단한다.

실제 공고(성원교회)로 보면 — 자리가 4개인데도 대부분 채워진다:

| 원문 | 필드 | 값 | 왜 |
|---|---|---|---|
| 모집인원: 전임목사, 교육목사, 여전도사, 교육전도사 | `position` | `{ASSOCIATE_PASTOR, EVANGELIST}` | 배열. 4문구 → 2키(중복 제거). "교육"은 `department` 축, "전임"은 `employment_type` 축이라 직분에서 빠진다(직교화 원칙) |
| 〃 | `headcount` | `"전임목사, 교육목사, 여전도사, 교육전도사 00명"` | **원문 그대로** — 자리 구성이 여기 남는다 |
| 모집부서: 주일학교 | `department` | 하나로 정해지면 채운다 | ⚠️ 우리 enum과 1:1이 아닌 표현(주일학교·교육부)은 `ETC`/NULL 후보 — 검수에서 판단 |
| 지원자격: 1980년 이후 출생자 | `requirements[]` | 채운다 | 자리 공통 |
| 사례비: 교회 내규 대로 | `pay_note` | 채운다 | 자리 공통 |
| (없음) | `employment_type` | NULL | **안 적혀 있어서** — 자리 수와 무관 |
| 제출기한: 충원시까지 | `deadline` | NULL | 날짜가 아니다(= 상시모집) |

**자리마다 다를 때만 비운다** — *"1.부목사(전임) 2.교육목사 3.여전도사(전임)"* 에서 `employment_type`은 부목사·여전도사만 전임이고 교육목사는 안 적혀 **하나로 못 정하므로** NULL. 셋 다 (전임)이었으면 `FULL_TIME`을 채운다.

> ⚠️ **틀린 값으로 필터에 걸리는 것보다 안 걸리는 게 낫다.** `employment_type=FULL_TIME`으로 찍으면 파트를 찾던 사람이 헛걸음하고, 전임을 찾던 사람은 교육목사 자리도 전임인 줄 안다. §nullable 원칙("DEFAULT로 값을 지어내지 않는다")의 연장이다.

**규모(크롤러 실측)**: 직분 2개 이상 언급 중 대부분은 *한 자리인데 자격만 열어둔 것*(`"전임사역자(전도사, 강도사, 목사)"` — 826건)이라 **전부 채워진다**. 자리가 진짜 여럿이라 일부 칸이 비는 건 소수다. `department` 다중 69건(2.2%) · `employment_type` 열어둠 76건(2.4%) → 둘 다 **단일 컬럼 유지**하고 NULL로 감수한다(배열화하면 min_job 코드가 대폭 늘고 실익이 2%대).

**Phase 2에서 자리별로 나눌 때**: `review_data` 1행 → `jobs` N건. 근거는 `headcount`의 원문과 `source_data`의 원자료라 **재수집 없이** 가능하다. ⚠️ 단 `review_data.published_job_id`가 **단수**라 N건을 기록할 수 없다 — 그때 배열이나 조인 테이블이 필요하다(min_job_agent 소관).

#### 공고가 성립하는 최소 조건 — 필수 5 + CHECK 2 (= 크롤러 승격 판정 규칙)

**크롤러 백업 3,181건 실측으로 검증해 조건을 8개 → 7개로 줄였다(2026-08-05).** "이게 없으면 사역자가 이 공고를 보고 아무 행동도 할 수 없나"가 기준이다.

| | 조건 | 강제 방법 | 실측 근거 |
|---|---|---|---|
| 🔴 | 어느 교회인가 | **`jobs.church_name NOT NULL`** (`church_id`는 nullable) | 교회명 커버율 **96%** — 없는 124건은 이 제약이 자동 차단 |
| 🔴 | 제목 | `jobs.title NOT NULL` | 3,181/3,181 |
| 🔴 | 사역직/일반직 | `jobs.job_kind` **비어 있지 않은 배열**(CHECK ①) | AI 판정, 애매하면 `confidence=low`로 운영자에게 |
| 🔴 | 요약 | `jobs.description NOT NULL` | **빈 공고를 막는 유일한 장치** — 본문·이미지·첨부가 전무한 공고 CSU 53건 + YTUS 1건 실측 |
| 🔴 | 게시일 | `jobs.posted_at NOT NULL` | JobPosting의 `datePosted`가 Google 필수 필드고, **상시모집 90일 판정의 기준일**이다. 없는 60건은 검수에서 입력 |
| 🟡 | 직분 또는 직무 | CHECK ① | `job_kind`와 상호 일치. 혼합 공고는 둘 다 채운다 |
| 🟡 | 연락처 최소 1개 | CHECK ② | 0종 160건이지만 대부분 비채용 글·포스터 내 연락처 |

+ 시스템 필드 `status`(DEFAULT 'OPEN') · `source` · `featured_tier`(DEFAULT 'NONE') · `pay_period`(DEFAULT 'MONTH') — 항상 INSERT 시점에 알 수 있다.

> ⚠️ **`jobs`의 CHECK는 4개인데 승격 게이트는 위 2개뿐이다.** 나머지 ③ `source='CHURCH' OR source_url IS NOT NULL` · ④ `source='OPERATOR' OR church_id IS NOT NULL`은 크롤 데이터에선 항상 참이라(수집물엔 원문 URL이 있고 `source`는 언제나 `OPERATOR`) 승격 판정에 관여하지 않는다.

##### 필수에서 **뺀** 2개 — 게시판이 안 주거나 원문에 없을 수 있는 값

| 필드 | 뺀 이유(실측) | **대신 화면이 해야 할 일** |
|---|---|---|
| `churches.denomination` | 교회 서술 문장에 교단 명시 **2.8%**(CSU만 `order_name` 필드로 83%). 교회 1,004곳을 사람이 채우면 30초씩 8시간 — 비현실 | "교단 미상". `denomination_source`가 `stated`·`registry`·`operator`일 때만 **확정으로 표시**하고 `unknown`·`ai_guess`는 회색/미상 처리 |
| `churches.region` | 광역 81% · 시군구 85% — 나머지 19%는 원문에 없다 | "지역 미상". ⚠️ **지역 필터 선택 시 무조건 탈락**한다(`filter-jobs.ts`가 `region.has(...)`) → 지역은 구직자 1순위 필터라 **사실상 안 보이는 공고**가 된다 |

> **크롤러가 받는 규칙(한 문장)**: 교회 매칭 · 제목 · `job_kind` · 직분 또는 직무 · 요약 · 연락처 1개 — **이 6개를 못 채우면 승격 불가.** 교단·지역·게시일은 비어도 승격된다. 크롤러는 6개 중 못 채운 게 있으면 `confidence=low`로 표시해 운영자가 먼저 보게 한다(min_job_agent 구조화 단계).
>
> ⚠️ 이 문서에서 말하는 **"검수"는 전부 `review_data`의 `PENDING`을 보는 검수 브릿지**(`/admin/ingest`)다. `APPROVED`는 크롤러가 검수 없이 공개한다(§10). **`/admin/jobs`가 아니다** — 거긴 이미 공개된 공고를 관리하는 화면이라 미상 값을 채우는 자리가 아니다(2026-08-17에 한 번 혼동해 엉뚱한 할 일을 만들었다).
>
> **검수 우선순위는 교단보다 지역이다** — ⓐ 커버율 81%로 이미 높아 채우기 쉽고 ⓑ 교회명만 검색해도 주소가 나오고 ⓒ 비면 필터에서 사라지는 실질 손실이 크다. 교단은 "미상"으로 공개해도 지원에 지장이 없다.
>
> ⚠️ **교회 식별은 claim으로 미룬다 (2026-08-06 확정 — 어제 `church_id NOT NULL`을 뒤집었다).**
>
> 크롤러가 교회 묶기를 실측했더니 **자동 95%까지만 되고 사각지대가 남았다**: (교회명+광역) 1,203그룹 중 신호 일관 511 · **검증 불가 67개**('일관'처럼 보이지만 실제로 다른 교회일 수 있음) · **같은 연락처에 다른 교회명 83건**(`대구대동교회`/`대동교회` 표기 차이 + 교단 사무실 공유). 사람이 봐도 판정이 안 되는 구간이다.
>
> **두 오류의 무게가 다르다** — 다른 교회를 합치면(B교회 페이지에 A교회 공고) 이미 공개된 뒤라 **되돌리기 어렵고**, 같은 교회를 나누면 중복 행이 생기지만 나중에 병합할 수 있다. 그래서 기본값을 "증거 없으면 합치지 않는다"로 두고, 끝까지 밀어 **교회 행을 아예 만들지 않는** 쪽으로 갔다.
>
> ```
> 크롤링 공고   church_id = NULL          "모른다" (정직)
>              church_name = "점촌제일교회"  공고가 말한 그대로
>              region = GYEONGBUK
>                  │
>                  ▼  교회가 가입·인증 → "이 공고들이 귀 교회 것입니까?"
>              church_id 채워짐 → 교회 상세 활성
> ```
>
> **확신 없는 `churches` 행을 만드는 것은 값을 지어내는 것**이고, 그건 위 nullable 원칙("DEFAULT로 값을 지어내지 않는다")과 같은 위반이다. 그리고 이 구조는 **claim을 교회 가입 유인으로 바꾼다**(mock의 `job-101` 클레임 데모가 같은 개념).
>
> **받아들인 대가 4개**:
> 1. **재공고 추적은 아예 보류했다**(§6) — 판정 키가 `church_id`에 묶여 있어 claim 전에는 거짓 숫자가 나온다. 끌어올림 판정은 크롤러 + admin 검수 확인으로 넘겼다
> 2. **`/churches/[id]`는 claim된 교회만** 존재한다
> 3. **`jobs.region`·`jobs.denomination` 비정규화** — §1 "공고에 교회 속성 복사 안 함"의 **명시적 예외**. `featured_tier`와 같은 취급(캐시된 쿼리가 JOIN 없이 필터·정렬해야 함). 교단은 2026-08-20 추가 — 그전까지는 "교단 필터가 claim 전까지 안 걸린다"가 대가였다

> ✅ **확정 설계(크롤러 피벗 2026-07-28)**: `job_kind` · `role` · `position` NULL 허용은 개교회 채용 확장(사역직 MINISTRY + 일반직 GENERAL) + 크롤러 `review_data` 정합을 위한 확정 설계다. 마이그레이션 SQL은 별도 작업(deferred).

> ✅ **확정(2026-08-04~05) — 폼이 앞섰던 필드는 모두 컬럼으로 반영.** `/jobs/new` 폼에만 있던 7항목: 모집 인원 → `headcount text` · 부임 시기 → `start_timing text` · 전형 절차 → `process_steps text[]` · **접수 방법 → `contact_email`·`contact_tel`·`contact_link`·`contact_post` 4컬럼** · 제출 서류 필수/선택 → `required_docs` + `optional_docs` 2배열 · 사택 3상태 → **`housing_provided` nullable boolean**(enum 신설 X) + `housing_note` · 처우 비고 → `benefit_note text`. `preferred`(우대사항)는 폼에서 제외됨(자격 요건 자유추가로 흡수). 성별·연령·결혼 컬럼은 두지 않는다(가드레일).
>
> **연락처 = jsonb도 별도 테이블도 아니라 컬럼 4개.** `APPLY_METHODS`가 `ETC` 없는 **닫힌 4키**(EMAIL·LINK·TEL·POST)이고 폼이 `Partial<Record<ApplyMethod, string>>`(방법당 1개)이라 컬럼이 1:1 대응한다 → 타입 안전·파싱 없음·폼 변경 0·JOIN 없음. `church_links`(테이블)와 갈리는 지점은 **집합이 열렸는지**다: `CHURCH_CHANNELS`는 `ETC` 포함 6키에 "채널 추가는 여기에만"이라 열려 있고, 접수 방법은 닫혀 있다. 폐기: `contact text`(대표 1개) · `apply_methods jsonb` — 같은 것을 두 형태로 저장하는 설계였다.
>
> **nullable 원칙 — "없으면 공고가 성립하나?"** 크롤링 원문 3,051건 실측 언급률(2026-08-04): 사택 40% · 전형절차 42% · 부임시기 45% · **고용형태 51%** · 모집인원 65% · 사례비·마감일 75% · 제출서류 88% · 연락처 89% · 자격/경력 90%. 원문 중간값 506자, **11%가 200자 미만**. 따라서:
> - **nullable로 푼다** — 원문에 없을 수 있고 없어도 공고가 성립하는 것: `employment_type`(51%) · `housing_provided`(40%) · `churches.denomination`(미상·무소속 실재) · 위 신규 컬럼 전부. **DEFAULT로 값을 지어내지 않는다** — "언급 없음"을 "미제공"으로 바꾸면 우리가 틀린 정보를 생산한다.
> - **NOT NULL·CHECK로 조인다** — 위 "최소 조건 — 필수 5 + CHECK 2". 여기선 제약이 **품질 게이트**로 작동해 승격 판정을 DB가 대신한다.
> - 화면에서 NULL은 **"정보 없음"** 으로 표시하고 필터에서는 제외한다(`qualification` NULL=무관과 같은 취급).

### `job_promotions` — 노출 구매 원장 (1 job : N, append-only)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `job_id` | uuid NOT NULL FK→jobs ON DELETE CASCADE | |
| `tier` | text NOT NULL CHECK (`PREMIUM`/`HERO`) | **`NONE` 없음** — 무료는 상품이 아니라 원장에 들어올 수 없다(`EXPOSURE_PRODUCTS`와 일치). `jobs.featured_tier`는 `NONE` 포함 3키로 역할이 다르다 |
| `weeks` | int NOT NULL CHECK (`1`/`2`/`4`) | `EXPOSURE_WEEKS`와 일치 |
| `amount` | int NOT NULL | 결제 금액(원, VAT 포함). `exposurePrice(tier, weeks)` 서버 재계산값과 대조 |
| `payment_id` | text NOT NULL **UNIQUE** | PortOne paymentId(38자 — KCP 40자 제한). **UNIQUE가 멱등성**: `/api/payments/complete`가 재시도돼도 노출이 두 번 적립되지 않는다 |
| `starts_at` | date NOT NULL | 노출 시작 |
| `ends_at` | date NOT NULL | 노출 종료 — `weeks`에서 계산 가능하지만 **저장한다**(정산·구좌 조회에 필요, 계산은 Server Action이 1회) |
| `status` | text NOT NULL CHECK | PAID/REFUNDED/CANCELLED — `PROMOTION_STATUSES`와 일치. ⚠️ **REFUNDED와 CANCELLED의 경계는 미정** — 값만 정해졌다. 주문 저장(ROADMAP 1-8 ①)에서 정한다 |
| `created_at` | timestamptz DEFAULT now() | |

> **왜 `jobs.featured_tier`와 둘 다 두는가.** 역할이 다르다 — 이 테이블은 **영수증 뭉치**(지우지 않음), `jobs`의 두 컬럼은 **"지금 이 공고는 HERO다"라는 비정규화 캐시**다. 원장만 두면 목록 한 페이지(공고 100개)를 그릴 때마다 "각 공고에 오늘 유효한 영수증이 있나"를 계산해야 하는데, `featured_tier`는 `filter-jobs.ts`의 **정렬 1차 키**로 최다 조회 경로다. 게다가 **`'use cache'` 안에서는 `new Date()`가 금지**라 캐시된 쿼리가 "오늘"을 알 수 없다. 그래서 결제 완료 Server Action이 캐시 컬럼을 미리 써준다(CLAUDE.md "집계·판정은 Server Action/query에서").
>
> **원장이 필요한 이유 4가지**: ① 주문·결제 이력(칼럼 2개는 현재 상태만 담아 이력 소실) ② 한 공고가 여러 번 구매(4주 쓰고 또 4주) ③ **`HERO`는 "구좌 한정"** 상품이라 "9월 첫째 주가 찼나"를 알려면 기간 행이 필요 — 칼럼만으론 미래 판매 불가 ④ 환불·정산 대응(KCP 월 4회 정산).
>
> **만료 강등 = seam이 `todayInSeoul()`을 만들어 넘긴다.** `'use cache'` 안에서 `new Date()`는 엔트리 생성 시 한 번 평가되고 그동안 고정되는데, 호출부가 전부 프리렌더 스코프라 거기서 만들면 **빌드 시각이 굳는다** → `lib/queries/*`가 만들어 넘기고 `cacheLife("days")`로 하루마다 갱신된다(최대 하루 지연, 목록 자체가 하루 캐시라 무해). **`deadline` 만료(§6-1)와 같은 코드 경로.**

### `users` — 계정 프로필 (Supabase `auth.users`와 1:1)

> **단일 계정 모델**: 모든 계정은 기본 **사역자(MINISTER)** — 배타적 role 없음. 검색·북마크·관심 교회는 누구나. **교회 인증(증빙 서류 + 운영자 승인)을 통과하면** 같은 계정에 **교회(CHURCH) view가 열려** 자기 교회 공고를 관리. "교회 전용 계정"은 없다(교회는 `churches` 엔티티, 사람 계정은 관리 자격).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK, FK→`auth.users.id` ON DELETE CASCADE | ⚠️ **행은 로그인할 때 `auth/callback`이 만든다**(2026-08-21 · upsert). DB trigger 금지(§1)라 Supabase 표준인 `on auth.user created` 트리거를 쓰지 않는다. 세션을 발급하는 곳이 콜백 한 곳뿐이라 **세션이 있으면 이 행도 있다** — 단 upsert가 실패하면 콜백이 **세션을 폐기**해 그 불변식을 지킨다(행 없이 로그인된 상태가 굳으면 나중에 인증 신청이 갱신할 행을 못 찾는다) |
| `email` | text **NOT NULL** | `auth.users`에서 복제. `auth` 스키마는 PostgREST로 JOIN하기 어려워 표시·운영자 조회용으로 둔다 |
| `church_id` | uuid FK→churches NULL | 이 계정이 관리하는 교회(인증 후 연결). NULL=일반 사역자 |
| `church_verification_status` | text NULL (CHECK) | PENDING/APPROVED/REJECTED. NULL=미신청 |
| `verification_doc_path` | text NULL | 증빙(고유번호증/사업자등록증) **비공개 Storage 경로**. ⚠️ 서류에 적힌 **등록번호·서류 종류는 저장하지 않는다** — 운영자가 파일을 열어 확인하면 되고, 저장하면 사업자번호 보관 부담만 진다. 보관·파기 정책은 §11 |
| `verification_applicant_name` | text NULL | 신청자 **실명**. Google 표시명은 닉네임일 수 있어 따로 받는다 |
| `verification_applicant_position` | text NULL (CHECK: position) | 신청자 직분 — 담임이 신청했는지가 검수 신뢰도 판단에 쓰인다 |
| `verification_contact_tel` | text NULL | 신청자가 적어낸 **교회 사무용 전화**(신청 필수). **`churches.contact_tel`에 바로 쓰지 않는다** — 미승인 신청자가 이미 인증된 교회의 대표 연락처를 덮어쓸 수 있기 때문. 승인 시 `churches`로 옮긴다. 검수는 이 값을 공개 게시판 공고·홈페이지와 **대조**하고, 기존 교회면 `churches.contact_tel`과도 비교한다(어긋나면 반려 근거) |
| `verification_contact_email` | text NULL | 〃 사무용 이메일(신청 선택 — 이메일 없는 작은 교회가 실재) |
| `verification_submitted_at` | timestamptz NULL | 검수 큐 정렬(오래된 신청 우선) |
| `verification_reviewed_at` | timestamptz NULL | 승인·반려 시각 |
| `verification_rejection_reason` | text NULL | 반려 사유. 없으면 신청자가 **뭘 고쳐야 할지 모른다** |
| `created_at` | timestamptz DEFAULT now() | |

⚠️ **신청자 전화번호는 받지 않는다** — 신청자가 적은 번호로 확인 전화를 걸면 사칭자가 자기 번호를 적고 자기가 받으므로 **검증이 성립하지 않는다.** 검증은 `churches.contact_email`·`contact_tel`을 **공개 출처와 대조**하는 쪽으로 한다. 연락은 `users.email`(Google OAuth로 이미 검증됨)로 충분하다.

- **교회 view 개방 조건** = `church_id IS NOT NULL AND users.church_verification_status='APPROVED' AND churches.verification_status='APPROVED'` → 파생 `hasChurchAccess`(`lib/auth.ts`). **양쪽을 다 본다** — 사람만 승인하고 교회가 미검증이면 미승인 교회가 공고를 올린다.
  - 호출부가 8곳이고 전부 `CurrentUser` 하나만 받으므로, 교회 상태는 `CurrentUser.churchIsVerified`(boolean)로 **실어서 내려보낸다**. `getCurrentUser`는 `churchName` 때문에 어차피 `churches`를 조인하게 되므로(현재는 아직 조인 없이 상수 반환) 왕복이 늘지 않는다. 3상태를 싣지 않는 이유 = 호출부는 "승인됐나"만 알면 되고, 상태를 주면 8곳이 각자 해석할 여지가 생긴다.
- **CHECK 2개**
  ```sql
  -- 승인은 교회가 확정돼야 한다 (교회 없이 APPROVED면 게이트가 거짓 통과)
  CHECK (church_verification_status <> 'APPROVED' OR church_id IS NOT NULL)
  -- 반려엔 사유가 있어야 한다
  CHECK (church_verification_status <> 'REJECTED' OR verification_rejection_reason IS NOT NULL)
  ```
- **다중 담당자**: 여러 user가 같은 `church_id`(다대일) → 한 교회에 담당자 여럿. 권한은 "그 교회 인증 관리자인가"로 판정. Phase 1은 각자 독립 인증, 초대형은 Phase 2(→ `church_members` 조인 테이블로 승격).
- **이동**: 담당자가 다른 교회로 옮기면 기존 링크 해제(공고는 `church_id`에 매여 있어 교회에 그대로 잔류 — 작성자 컬럼이 없으므로 아무것도 끊기지 않는다) → 새 교회 재인증. 인증은 **교회별**.
- 운영자(admin)는 **DB 컬럼으로 두지 않는다** — `.env` `ADMIN_EMAILS` allowlist로 판정(2026-07-29, `lib/operator.ts`, 목록 비면 fail-closed). 남은 것 = 실 DB 전환 시 operator RLS. 개인정보 최소 수집.

### `bookmarks` — 사역자 북마크 (Phase 1 — 단일 계정이라 이동. 지금은 localStorage)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `user_id` | uuid FK→users | |
| `job_id` | uuid FK→jobs ON DELETE CASCADE | |
| `created_at` | timestamptz DEFAULT now() | |
| — | PK(`user_id`, `job_id`) | |

---

## 4. 관계

```
users (기본 MINISTER · 인증 시 CHURCH view)
  └─ church_id ─────────┐ (관리하는 교회, nullable · 다대일=다중 담당자)
                        ▼
churches ──1:N──▶ church_links · church_photos  (채널·사진)
   │
   │ 1:N  (nullable — 크롤 공고는 church_id=NULL, claim 때 연결)
   ▼
  jobs ──1:N──▶ job_promotions   (노출 구매 원장)
   ▲
   │ N:1
users ──▶ bookmarks ──▶ jobs     (Phase 1)
```
- **공고 소유 = 교회 엔티티(`jobs.church_id`)**. 작성자 컬럼은 **두지 않는다**(2026-08-07 `owner_id` 제거) — **편집 권한은 그 교회의 인증 관리자 여부로 판정**. 운영자 등록=`source=OPERATOR`, 교회 등록=`source=CHURCH`.
- **편집 게이트 = `church_id` 일치 + `source=CHURCH`**(2026-08-07). 운영자 등록 공고는 **클레임("가져오기")을 거쳐 `source`가 `CHURCH`로 바뀐 뒤에야** 편집된다 — 교회 대시보드가 managed(편집)/claimable(클레임)을 나눠 보여주므로, 게이트가 이보다 넓으면 **화면과 동작이 어긋난다**(수정해도 `source`가 `OPERATOR`로 남아 "가져오세요"가 계속 표시된다). `getChurchDashboard`의 `managed` 조건과 `getEditableJob`의 게이트는 **같은 술어를 유지**할 것.
- **교회 관리 링크**: 인증 승인 시 `users.church_id` 연결(다대일 → 다중 담당자). 담당자 이동 = 링크 해제(공고는 **교회에 잔류** — 공고가 사람에 매여 있지 않다) → 새 교회 재인증. 인증은 교회별.

---

## 5. 인덱스

- `jobs(status)` — 대부분 쿼리가 OPEN 필터
- `jobs(posted_at DESC)` — 최신순 정렬
- `jobs(featured_tier, featured_until)` — 노출(프리미엄·대표광고) 조회
- `job_promotions(job_id)` — 공고별 결제 이력
- `job_promotions(tier, starts_at, ends_at)` — HERO 구좌 잔여 판정(특정 주가 찼는지)
- `jobs(department)`, `jobs(employment_type)` — 목록 필터
- **`jobs USING GIN (position)`**, **`jobs USING GIN (job_kind)`** — 배열 컬럼. 필터는 `=`가 아니라 **`@> ARRAY['EVANGELIST']`** 로 건다
- `jobs(region)` — **지역 필터(최다 사용)**. `church_id`가 NULL일 수 있어 JOIN이 아니라 이 컬럼으로 건다
- `jobs(denomination)` — 교단 필터. 같은 이유로 JOIN이 아니라 이 컬럼(2026-08-20)
- `jobs(church_id)` — 교회별 공고(claim된 것만)
- `churches(denomination)`, `churches(region)` — **교회 상세 전용**. 목록의 교단·지역 필터는 위 `jobs` 컬럼이 담당한다(§1 예외 1)
- `church_links(church_id)`
- `churches(verification_status)` — 공개 조회가 `APPROVED`만 거른다(RLS 정책 조건과 동일)
- `users(church_id)` — 교회별 담당자 조회(다중 담당자)
- `users(church_verification_status)` — 운영자 검수 큐(PENDING 목록)
- `bookmarks(user_id)`

---

## 6. 재공고 추적 — ⛔ **보류(2026-08-07)**

**기능을 코드에서 제거했다.** `lib/repost-tracking.ts` 삭제 · 공고 상세의 "재공고 N회" 배지·이력 섹션 제거 · 교회 상세는 자리별 묶음 대신 **평면 "지난 공고" 목록**(`getChurchPastJobs` → `PastJob[]`)으로 교체.

**왜 뺐나** — 판정 키가 `church_id + position + department`였는데 **`church_id`가 nullable이 됐다**(교회 식별을 claim으로 미룸, §3). 그러면 claim 전 공고가 전부 `null:직분:부서` 한 덩어리로 묶여 **서로 무관한 교회들의 공고가 합산된 거짓 숫자**가 나온다. "안 잡힌다"가 아니라 **틀린 값을 공개한다**는 게 문제였다.

**끌어올림(bump) 판정도 우리 일이 아니다** — 크롤러(min_job_agent)가 수집 단계에서 묶고, min_job admin 검수 화면에서 *"이거 끌어올리시겠습니까?"* 로 운영자에게 확인받는다. 우리는 N일 임계값을 정하지 않는다.

**되살릴 때** — claim이 돌아 `church_id`가 채워진 뒤가 자연스럽다. 그때 키는 `church_id + position + department`(claim된 것만) 또는 크롤러와 같은 `연락처 + 직분 + 부서` 중 선택. **마감(CLOSED) 공고를 공개 유지하는 정책은 그대로**(§9 RLS) — 교회 상세의 지난 공고가 그 위에서 돈다.

---

## 6-2. 시간 취급 — 저장 / 판정 / 표시 3층 (2026-08-21 확정)

시간은 **두 종류**이고 컬럼 타입이 그 차이를 담는다. 섞으면 하루씩 어긋난다.

| | 컬럼 | 무엇인가 |
|---|---|---|
| **`timestamptz`** (8개) | `churches.created_at` · `users.verification_submitted_at`·`_reviewed_at`·`created_at` · `jobs.created_at`·`updated_at` · `job_promotions.created_at` · `bookmarks.created_at` | **사건이 일어난 순간.** 하나의 진실 — 어디서 읽어도 같다 |
| **`date`** (5개) | `jobs.posted_at`·`deadline`·`featured_until` · `job_promotions.starts_at`·`ends_at` | **사람이 정한 날짜.** "한국의 8월 31일"이라는 라벨. 시간대를 붙이면 오히려 틀린다 |

**① 저장** — 그대로 둔다. `timestamptz`는 입력을 받는 순간 **절대 시점으로 정규화**하므로 `+09:00`으로 넣든 `Z`로 넣든 저장값이 같다. **"KST로 저장"은 불가능하고 필요도 없다** — 시간대는 읽을 때 정해진다. ⚠️ 유일한 위험은 **오프셋을 뺀 naive 입력**(서버 시간대=UTC로 해석돼 9시간 어긋난다) — 크롤러가 `ensure_kst`로 거부한다(min_job_agent `clock.py`).

**② 판정** — `date`를 비교할 때 "오늘이 며칠인가"는 **`todayInSeoul()`**(`lib/job-visibility`)만 정한다. Vercel 서버가 UTC라 `new Date()`를 직접 쓰면 한국 00:00~09:00 사이에 **어제**가 나온다. `lib/queries/jobs.ts`의 쿼리 전부가 이걸 쓴다. `date`에 KST 기준이 아닌 날짜가 섞이면 복구 불가이므로, **`posted_at`은 게시판이 준 날짜를 변환 없이** 받는다(크롤러 `clock.py` — 변환하면 하루 밀린다).

**③ 표시** — `timestamptz`를 화면에 그릴 때는 **`formatKstDate()`**(`lib/format`)를 거친다. 그대로 그리면 UTC가 나와 날짜가 하루 어긋난다(Supabase 대시보드가 UTC로 보여주는 것과 같은 현상). `date` 컬럼은 변환 대상이 아니다 — 시간 표시는 `RelativeTime`이 클라이언트에서 계산한다.

⚠️ **시각 정렬은 문자열이 아니라 시점으로 비교한다.** ISO 문자열 비교는 오프셋 표기가 섞이면 틀린다(`2026-07-29T00:00+09:00`이 `2026-07-28T23:00Z`보다 이른데 문자열로는 뒤로 간다). 한 소스에서 오는 값은 표기가 일정해 우연히 맞지만 그 전제에 기대지 않는다. DB 전환 후에는 SQL `order by`가 시점으로 정렬한다.

---

## 6-1. 공개 노출 규칙 — 만료 (2026-08-14 확정)

> **크롤러는 이 규칙을 몰라도 된다**(2026-08-20 확정). 크롤러는 수집·공개만 하고, 무엇을 언제까지 보여줄지는 min_job이 판정한다(`lib/job-visibility.ts`). 끌어올림은 크롤러가 **자기 기준(원문 게시일 3개월 창)**으로 이미 구현했다 — 두 규칙은 목적이 달라 공유할 필요가 없다.

`status` 하나만 믿으면 **마감일이 지난 공고가 영원히 "모집중"** 으로 남는다. 실측: mock OPEN 79건 중 **55건이 마감일 경과**. 크롤링 공고의 75%가 마감일을 가지므로 실데이터에서 그대로 재현된다 — sitemap이 만료 URL을 신선한 콘텐츠로 광고하고 `JobPosting`이 과거 `validThrough`를 계속 내보낸다.

```
공개 목록에 뜬다 =
    status === 'OPEN'
    AND ( deadline !== null ? deadline >= today
                            : posted_at + ALWAYS_OPEN_MAX_DAYS >= today )
```

| 결정 | 근거 |
|---|---|
| **`status`는 `OPEN` 그대로 두고 파생 계산으로 숨긴다** | 크롤링 공고가 실제로 마감됐는지 **우리는 모른다**. 모르는 걸 `CLOSED`로 쓰면 "교회가 닫은 것"과 "우리가 날짜로 판단한 것"이 구별되지 않고 되돌릴 수 없다(§nullable 원칙과 같은 이유). 파생이면 원본이 보존되고 90→120일 변경이 즉시 반영된다. **배치·Cron 불필요** |
| **`CLOSED`는 진짜 의사표시만** | 교회가 "마감했습니다"를 누른 것만 저장(Phase 1 mutation) |
| **`ALWAYS_OPEN_MAX_DAYS = 90`** | 상시모집(마감일 없음)이 방치돼 영구히 "모집중"으로 남는 것을 막는다. mock 상시모집 20건의 게시 경과일 = 최소 36 · 중간 63 · 최대 113일 → 90일이면 3건이 걸린다. **짧게 잡아 살아있는 공고를 숨기는 게 더 나쁜 오류**라 넉넉히 잡았다 |
| **`today`는 cached scope 안에서 계산한다** | 호출부(`/jobs`·홈·`sitemap.xml`)가 전부 프리렌더 스코프라 거기서 `new Date()`를 부르면 **빌드 시각이 굳는다**. 캐시 안에서 계산하면 `cacheLife("days")`와 함께 하루마다 갱신된다 — 만료가 최대 하루 늦지만 공고 목록 자체가 하루 캐시라 무해하다. 인자로 넘기려면 `await connection()`이 필요하고 `/jobs`·홈이 **`◐ PPR` → `ƒ`** 로 떨어진다 (CLAUDE.md `'use cache'` 제약 #2) |

> ⚠️ **알려진 취약점 — 캐시 엔트리별 `today`가 갈릴 수 있다.** `getAllJobCards`와 `getJobStats`는 **서로 다른 캐시 엔트리**라 각자 `todayInSeoul()`을 만든다. 둘이 자정을 사이에 두고 따로 갱신되면 헤더의 "지금 모집 중 N건"과 실제 카드 수가 **그날 만료되는 건수(보통 0~2건)만큼** 어긋난다. `updateTag("jobs")`로 무효화하면 둘 다 같이 재생성돼 즉시 일치하므로, **시간 만료로 각자 갱신될 때만** 벌어지고 최대 하루면 맞는다.
> 없애려면 `getJobStats`를 지우고 목록 한 엔트리에서 숫자를 파생시키면 되지만, 홈이 전체 카드를 받아야 해서 무거워진다. **실데이터가 커져 눈에 띄면 그때 합친다.**

**숨김 범위**

| 곳 | 처리 |
|---|---|
| 목록·검색·홈 · `sitemap.xml` · `JobPosting` JSON-LD | **제외** |
| **공고 상세 페이지** | **살린다** + "마감" 배너 — 기존 롱테일 SEO 정책과 일관(`status=CLOSED`도 그렇게 동작) |
| 교회 상세의 "지난 공고" | 계속 보임 |
| **교회 대시보드** | **계속 보임** + "게시 90일 경과 — 갱신하면 다시 노출" 안내. 교회 입장에서 "우리 공고가 갑자기 사라졌다"가 되면 안 된다. 갱신(= `posted_at` 갱신)은 Phase 1 mutation |

---

## 7. 노출(광고) 모델 — 프리미엄·대표광고 2종

- **저장은 2군데** — 원장 `job_promotions`(결제 이력·구좌 판정) + 캐시 `jobs.featured_tier`·`featured_until`(현재 유효 노출). 근거는 §3 `job_promotions`.
  - **프리미엄**(PREMIUM) = 목록 상단 고정 + 강조 배지
  - **대표광고**(HERO) = 홈·목록 최상단 추천(AD) 슬롯, 더 크게. **구좌 한정** → 특정 주가 찼는지는 `job_promotions`의 기간 행으로 판정(캐시 컬럼으로는 미래 판매 불가)
- **만료 자동 강등 = cached scope 계산.** ⚠️ `'use cache'` 안에서 `new Date()`는 **엔트리가 만들어질 때 한 번** 평가되고 그동안 고정된다(CLAUDE.md 제약 #2). 호출부(`/jobs`·홈·`sitemap.xml`)가 전부 프리렌더 스코프라 **거기서 만들면 빌드 시각이 굳으므로**, `lib/queries/*`가 `todayInSeoul()`로 만들어 mock/DB에 넘긴다. `cacheLife("days")`와 함께 하루마다 갱신되어 만료가 최대 하루 늦게 반영된다(목록 자체가 하루 캐시라 무해). 인자로 받으려면 `await connection()`이 필요하고 `◐ PPR` → `ƒ`. **`deadline` 만료(§6-1)와 같은 코드 경로.**
- **정렬 반영**: 노출 등급 우선 → 최신순(`posted_at`). (끌어올리기/bump 없음 — 저볼륨이라 제외)
- **가격은 확정**(`EXPOSURE_PRODUCTS` 단일 소스: PREMIUM 주 7만/4주 24만 · HERO 주 15만/4주 50만, VAT 포함). 결제·서버 검증 구현 완료, **실카드결제 활성(2026-08-05)** — 실연동 채널이라 카드가 실제로 청구된다. `/pricing`은 아직 "문의" — 교회 멤버십 미배선으로 결제 경로에 도달 불가(ROADMAP 1-8·8). ⚠️ **노출 적용·취소는 아직 수동**이다(주문 저장·`featured` 세팅이 없다) — 운영자가 PortOne 콘솔을 보고 처리하고 이메일로 안내한다. 결제 화면이 그 사실을 밝힌다(2026-08-19 — 그전까지 "테스트 모드 — 실제 청구는 없어요"라고 **거짓 안내**하고 있었다).
- 기독 B2B 배너 광고 = 별도 광고주·ad ops → Phase 2+ 옵션(레일 슬롯만).

---

## 8. 사례비 표현

- `pay_min` / `pay_max` (**만원 단위 정수**), `pay_period`(MONTH/YEAR, 기본 MONTH), `pay_note`(비정형 보존).
- 표시: 범위(`min~max만원`) / 단일(`min만원`) / 비정형(note) / 없음("협의"). `lib/format.ts` `formatPay`.
- 비교·정렬 시 period 고려(연봉은 월 환산 등) — 세부 규칙은 Phase 2.

---

## 9. RLS (의도 — 상세 정책은 Phase 1에서 확정)

| 테이블 | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `jobs` | **public (OPEN + CLOSED 모두)** ← 교회 상세의 '지난 공고'가 마감 공고를 노출 | **인증 관리자(그 공고 church_id)** + operator(전체 — `church_id`가 NULL인 크롤 공고 포함) |
| `churches` · `church_links` · `church_photos` | **public — 단 `churches.verification_status='APPROVED'`만** (+ operator는 전체). 미승인 교회가 검수 전에 노출되면 안 된다 | operator (+ 인증 관리자가 자기 교회 row) |
| `users` | 본인 | 본인 (`church_verification_status`는 운영자만 승인/변경) |
| `job_promotions` | **본인 교회 공고만**(결제 이력 = 그 교회 것) + operator | **INSERT는 Server Action(service-role)만** — 결제 검증 통과 후. UPDATE/DELETE 없음(append-only 원장, 환불은 `status` 변경으로 operator만) |
| `bookmarks` | 본인 | 본인 |

> ⚠️ **`churches` 공개 조회에는 RLS가 방어선이 되지 못한다.** 공개 교회 조회는 cached read라 `service.ts`(secret 키)를 쓰는데 **그건 RLS를 우회한다**(§ Supabase 규칙). 따라서 `verification_status='APPROVED'` 조건은 **`lib/queries/churches.ts` 쿼리 본문이 직접 걸어야 하고, 그게 유일한 방어선이다.** RLS 정책은 `server.ts`(쿠키)로 도는 경로에만 걸린다 — 위 표는 그 경로의 의도다.

- `lib/supabase/service.ts`(service-role)는 RLS 우회 — **공개 cached read 전용**(공개 공고/교회 조회).
- 인증·권한 필요한 작업은 `server.ts`(anon+쿠키). Server Action에서만 mutation.

---

## 10. 구조화(ingest) 정책

- **수집 경로 2가지(2026-07-28 재정의)**: ① **크롤러(`min_job_agent`)가 공개 공식 게시판(신학교·교단, 31곳)에서 자동 수집** ② **사람이 붙여넣은 텍스트**. 두 경로 모두 → AI 구조화 → **리뷰 큐(`review_data`)**. ⚠️ **거기서 갈린다(가드레일 #1 개정 2026-08-20 · 운영자 확정)**: 확인할 것이 없는 초안은 **크롤러가 `APPROVED`로 판정해 `jobs`에 직접 INSERT**하고, 사람이 봐야 답이 나오는 것만 `PENDING`으로 남아 운영자 검수를 거친다.
  - **개정 경위**: 2026-08-16 자동 승인 도입 → 2026-08-18 공개 주체를 크롤러로 확정(그전엔 `APPROVED`를 넣는 코드가 없어 아무것도 공개되지 않았다).
  - **개정 전 원칙**: "운영자 검수 없이는 절대 공개 X". ⚠️ 2026-07-28 법률 검토가 **그 전제로** 통과했다 — 바뀐 것은 "모든 건을 사람이 보나"이고, **요약 + 출처 링크 · 개교회 공개게시판 한정 · opt-out**이라는 본체는 그대로다. 자동 공개분의 품질 방어선은 크롤러 쪽 게이트(원문에 없는 값 비우기 · 이단·마감 자동 거절 · 애매하면 `PENDING`)다. 상업·비공식 출처는 여전히 배제(가드레일 #4).
- 운영자 등록 = `source=OPERATOR`. ⚠️ **크롤러가 넣는 것도 `OPERATOR`다** — 출처 구분은 `source`가 아니라 `review_data.published_job_id` 연결로 한다.
- ⛔ **크롤러는 `churches`에 쓰지 않는다**(2026-08-06 확정). 크롤 공고는 `church_id=NULL`로 들어가고 교회명은 `jobs.church_name`이 담는다. 교회 행은 **교회가 가입·인증해 claim할 때** 연결된다. 자동 교회 매칭을 하지 않는 이유: (교회명+광역) 묶음 1,203개 중 67개는 연락처가 없어 동명이교회 충돌을 확인할 수 없고, **다른 교회를 합치면**(B교회 페이지에 A교회 공고) 되돌리기 어렵다.
- **지원용 공개 연락처(`contact_email`·`contact_tel`·`contact_link`·`contact_post`)는 저장·공개** — 교회가 지원받으려 공개한 전화·이메일·지원 링크만. 지원과 무관한 제3자 개인정보는 저장·노출하지 않음(가드레일 #3 갱신). 그 외 교회 공개 채널(`church_links`)·원문 링크(`source_url`)로도 안내.
- 크롤러 staging 4테이블(§12)은 `min_job_agent`가 소유(생성·변경·마이그레이션 전부 그쪽). min_job은 `review_data`의 **`PENDING`을 검수 브릿지로 읽고 승인·거절·값 수정**을 한다 — 지켜야 하는 불변식은 §12.

---

## 11. 미확정 (추후 확정)

- **노출 상품 상세** — 가격·기간·묶음할인·부가세·결제 수단 (Phase 2, ROADMAP 2-3)
- ⚠️ **크롤러 자동 공개 적법성 — 다시 열렸다(2026-08-20)**. 2026-07-28 법률 검토는 **"운영자 검수 없이는 공개 X"를 전제로** 통과했는데, 가드레일 #1 개정으로 그 전제가 바뀌었다(§10). 요약+출처 링크·개교회 공개게시판 한정·opt-out이라는 본체는 그대로지만 **"모든 건을 사람이 보나"가 달라졌으므로**, 약관·개인정보처리방침 정식 검토(아래) 때 **함께 확인할 것**. (로그인 티어 소스는 별도 게이트 — min_job_agent CONTRACT §6)
- **이용약관·개인정보처리방침** — 현재 초안, **정식 운영 전 법률 검토 필수** (ROADMAP 1-6). privacy의 수집항목·위탁·보유기간은 검토 시 스키마와 정합 확인(크롤러 수집 적법성과는 별개 항목)
- **enum/type 공유 방식** — min_job `constants/domain.ts`·`types/domain.ts`의 도메인 enum·타입을 크롤러(`min_job_agent`)가 어떻게 공유할지(copy / npm package / path 참조) 미정
- **자동 결제 연동** (Phase 3)
- **인재 DB**(`minister_profiles`, 계정에 1:1) — 사역자 프로필 (Phase 3, 개인정보 동의). "구직 중" opt-in 노출 + "제외 교회"(자기 교회엔 숨김)
- **관심 교회 팔로우**(`church_follows`) + 새 공고 알림 (Phase 2, 사역자 view)
- **교회 인증 증빙 문서 보관·파기 정책** (`users.verification_doc_path` + `verification_applicant_name`·`position`). 파일은 **비공개 Storage 버킷 + operator만 읽기**. ⚠️ **공개 개인정보처리방침이 이미 "인증 처리 완료 후 지체 없이 파기"를 약속**했으므로(`/privacy`), 승인·반려 Server Action이 **처리 직후 파일을 지우고 `verification_doc_path`를 NULL로** 돌려야 한다. 보관 기간을 두려면 방침 문구부터 바꿔야 한다(법률 검토와 함께)

---

## 12. 크롤러 staging (min_job_agent 소유)

> 자매 리포 **`min_job_agent`**(크롤러)가 공개 공식 게시판에서 수집·구조화한 초안을 쌓는 **스테이징 4테이블**. 물리적으로는 min_job Supabase 프로젝트에 함께 살지만 **소유·정의·마이그레이션은 전부 `min_job_agent`**. min_job은 이 테이블을 **인지하고 충돌만 회피**한다 — 생성·변경·마이그레이션·RLS를 만들지 않는다(테이블명·마이그레이션 파일 충돌 회피만). **상세 정본 = `../min_job_agent/docs/SPEC.md` §6.**

| 테이블 | 역할 |
|---|---|
| `source_data` | 원자료 + 원장 (불변·write-once·누적). `raw_text`·`raw_meta` + `UNIQUE(source_key, external_id)`로 증분·중복 방지 |
| `review_data` | 구조화 초안 + 검수 (가변). **`PENDING`만 min_job admin이 소비** — `APPROVED`는 크롤러가 이미 `jobs`에 공개했다(§10) |
| `source_health` | 게시판별 상태 (약 31행, 매 실행 UPSERT) — 마지막 실행·성공·신규건수·연속실패 |
| `crawl_run` | 실행별 요약 (1실행 1행, 누적) — started/finished·mode·성공/실패 소스·신규 집계 |

- **RLS = 운영자 전용**(min_job admin이 대시보드·검수에 read), 크롤러는 service-role로 write. **public 노출 없음.**

- **`pay_period` — 주기를 모르면 금액도 내보내지 않는다(크롤러 코드 불변식 · 2026-08-21 확정).** 크롤러가 주기를 못 정하면 `pay_period`만 빼는 게 아니라 **`pay_min`·`pay_max`도 INSERT 본문에서 빼고 원문 표현을 `pay_note`에 남긴다.** 따라서 **"금액은 있는데 주기가 없는 행"은 구조적으로 생기지 않는다** — 실측 0건(694건)이 아니라 코드가 보장한다.
  - **왜 필요한가**: `jobs.pay_period`가 `NOT NULL DEFAULT 'MONTH'`라 키를 빼면 `MONTH`가 들어가고, 승격 후엔 **"월급"과 "모른다"를 구분할 수 없다.** 금액이 함께 빠지면 주기가 가리킬 대상이 없어 무해하다(화면도 금액이 없으면 주기를 렌더하지 않는다 — `formatPay`). 원칙은 **빈 칸 > 틀린 값**.
  - **판정 방식**: 원문에 주기 표기가 있으면 그대로. 없으면 금액 크기로 — `≤500만원 → MONTH` · `≥1,000만원 → YEAR` · **501~999만원 = 판정 불가**(여기서 금액까지 비운다). 상수는 크롤러 `_MONTHLY_CEILING`·`_YEARLY_FLOOR`.
  - ⛔ **`review_status=PENDING`으로 붙잡지 않는다** — 사례비 한 칸이 애매할 뿐이고 교회·직분·연락처·마감은 정상이라, 공고 전체를 검수 큐에 세우는 건 과하다. 그 칸만 비우면 공고는 제 역할을 한다.

- ⚠️ **크로스 리포 동기화 필요(2026-08-05)** — 이번 스키마 확정으로 `review_data`와 어긋나는 지점 4개. `review_data`는 min_job_agent 소유라 우리가 바꾸지 않고 **승격 시 매핑**하거나 크롤러 쪽에 반영을 요청한다:
  1. ✅ **해소됨(2026-08-19 확인)** — `stipend_*` → `pay_*` 개명. 크롤러 `models.py`가 이미 `pay_min`·`pay_max`·`pay_note`·`pay_period`다
  2. ✅ **해소됨(2026-08-19 확인)** — `contact` 단일 → 4컬럼 분해. 크롤러도 4컬럼이고 `APPLY_METHODS` 닫힌 4키와 1:1
  3. `denomination` **미상 = NULL**(ETC 아님) — "미상 교단은 승격 전 해소" 규칙은 **철회**됐다(무소속·독립교회가 실재)
  4. ✅ **정합 확인(2026-08-19)** — 승격 게이트 = **필수 5 + CHECK 2**(§3 jobs). **크롤러가 세는 것은 6개**: 교회명 · 제목 · `job_kind` · 직분 또는 직무 · 요약 · 연락처 1개. ⚠️ `posted_at`·`source_url`은 **세지 않는다** — 크롤러 `ReviewData` 레코드가 둘 없이는 만들어지지 않아 검사가 항상 참이 된다. 여기 한때 "7개"라 적혀 게시일을 세고 있었다(§3 237행의 6개가 정본). 교단·지역은 비어도 승격
