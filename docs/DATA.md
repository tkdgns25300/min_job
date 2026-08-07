# DATA.md — MinJob 데이터 설계

> **DB 스키마·enum·인덱스·RLS·구조화 정책·설계 결정**. 비즈니스 동작은 [`SPEC.md`](./SPEC.md), 아키텍처·컨벤션은 [`../CLAUDE.md`](../CLAUDE.md), 작업은 [`ROADMAP.md`](./ROADMAP.md).
>
> 이 문서는 **mock 단계에서 확정된 스키마**를 정본으로 옮긴 것. 실제 마이그레이션(`supabase/migrations`)·DB 타입 생성은 이 문서를 따른다. (mock: `src/mocks/*.json`, 타입: `src/types/domain.ts`, enum: `src/constants/domain.ts`)
>
> ⚠️ **살아있는 문서.** 페이지 디자인·기능을 고도화하며 필드가 늘면 이 문서·mock 스키마를 **함께 확장**한다. 데이터는 `lib/queries/*`(seam)로만 접근해 mock↔DB 전환 시 페이지 불변.

---

## 1. 설계 원칙

- **DB는 저장 전용.** trigger·custom function·복잡한 default expression 만들지 않는다. ID 발급·timestamp·집계·재공고 판정 등 로직은 전부 Server Action / query 함수. 내장 기능만 사용(`gen_random_uuid()`, `CHECK`, `FK`, array/`jsonb`).
- **정규화 유지 (JOIN).** 교단 필터는 `churches`를 JOIN해서 건다. 비정규화(공고에 교회 속성 복사) 안 함 — 우리 규모(초기 수백~수천)에선 JOIN + `'use cache'` 캐시로 충분. (대규모 인덱스 최적화 필요 시 나중에 재검토)
  - ⚠️ **명시적 예외 2개** — 둘 다 "캐시된 쿼리가 JOIN·`now()` 없이 필터·정렬해야 한다"는 같은 이유다: **`jobs.region`**(`church_id`가 NULL일 수 있어 JOIN이 성립 안 함 — §3) · **`jobs.featured_tier`·`featured_until`**(원장은 `job_promotions`, 이건 현재 유효 노출 캐시 — §7). 예외를 늘릴 때는 이 두 사례와 같은 근거가 있는지 확인할 것.
- **enum = 영어 대문자 key + 한글 라벨.** key는 DB에 저장(값)·URL params에 사용, 표시는 `constants/domain.ts`의 한글 라벨 맵. DB에서는 `CHECK` 제약으로 허용값 강제(별도 enum 타입 대신 `text + CHECK`로 확장 용이하게).
- **컬럼명 = `snake_case`** (DB), 앱(TS)은 `camelCase`. Supabase 생성 타입이 매핑.
- **가드레일 준수**: 공고 owner nullable · **지원용 공개 연락처(`contact_email`·`contact_tel`·`contact_link`·`contact_post`)만 저장·공개**(지원과 무관한 제3자 개인정보 X — 가드레일 #3 갱신 2026-07-28) · source로 출처 구분 · **수집 = 크롤러(공개 공식 게시판) + 사람 붙여넣기 → AI 구조화 → 운영자 검수·승격**("자동 크롤러 없음" 재정의, 가드레일 #1 갱신 · 법률 검토 완료).

---

## 2. enum 허용값 (`text + CHECK`)

| enum | 컬럼 | 허용값(key) |
|---|---|---|
| **denomination** (교단) | `churches.denomination` | HAPDONG · TONGHAP · BAEKSEOK · GOSIN · HAPSIN · GAMLI · SEONGGYUL · BAPTIST · SUNBOK · ETC · `NULL`(=미상·무소속) (10키 = 9대형 + 기타. **기장=ETC** — 미상을 ETC에 넣지 말 것) |
| **region** (광역) | `churches.region` · **`jobs.region`** | SEOUL · GYEONGGI · INCHEON · GANGWON · CHUNGBUK · CHUNGNAM · DAEJEON · SEJONG · GYEONGBUK · GYEONGNAM · DAEGU · ULSAN · BUSAN · JEONBUK · JEONNAM · GWANGJU · JEJU · OVERSEAS · `NULL`(=미상, 원문 명시 81%) |
| **church_channel** (채널) | `church_links.type` | HOMEPAGE · YOUTUBE · INSTAGRAM · FACEBOOK · BAND · ETC(기타) |
| **job_kind** (직군) | `jobs.job_kind` | MINISTRY(사역직) · GENERAL(일반직) — 개교회 채용 구분 |
| **position** (직분) | `jobs.position` | SENIOR_PASTOR · ASSOCIATE_PASTOR · EVANGELIST · LICENSED_MINISTER · ETC (사역직 MINISTRY만 · GENERAL은 NULL — XOR CHECK로 강제) |
| **department** (부서) | `jobs.department` | INFANT · CHILDREN · YOUTH · YOUNG_ADULT · DISTRICT · WORSHIP · ADMIN · ETC · `NULL` |
| **employment_type** (고용형태) | `jobs.employment_type` | FULL_TIME · SEMI_FULL_TIME · PART_TIME · `NULL`(=미상, 원문 언급률 51%) |
| **qualification** (자격/경력) | `jobs.qualification` | ANY · ENTRY · EXPERIENCED · ORDAINED · SEMINARIAN · `NULL`(=무관) |
| **pay_period** (사례비·급여 기간) | `jobs.pay_period` | MONTH(기본) · YEAR |
| **job_status** | `jobs.status` | OPEN(기본) · CLOSED |
| **job_source** (출처) | `jobs.source` | OPERATOR · CHURCH |
| **featured_tier** (노출) | `jobs.featured_tier` | NONE(기본) · PREMIUM · HERO(=대표광고) |
| **church_verification_status** (교회 인증) | `users.church_verification_status` | PENDING · APPROVED · REJECTED · `NULL`(=미신청) |

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
| `founded_year` | int NULL | 창립 연도 |
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
| `church_id` | uuid **NULL** FK→churches | 소속 교회. **NULL = 아직 어느 교회인지 확정 못 함**(크롤링 공고 기본값). 교회가 가입·인증 후 **claim하면 채워진다** → 그때 교회 상세·재공고 이력이 켜진다. ⚠️ 자동 매칭 금지 |
| `church_name` | text **NOT NULL** | **공고가 말한 교회명 그대로**. `church_id`가 NULL이어도 화면에 교회를 표시할 수 있게 하는 값. 교회 직접 등록 시엔 교회 프로필에서 복사 |
| `region` | text NULL (CHECK) | **공고 시점에 파악한 광역** — ⚠️ **의도적 비정규화**(§1 예외). `church_id`가 NULL이면 `churches`를 JOIN할 수 없어 지역 필터가 통째로 죽는다. 필터·정렬은 이 컬럼을 쓴다 |
| `owner_id` | uuid FK→users **NULL** | **작성자(감사용)** — 운영자 등록=NULL (가드레일 #2). ⚠️ 편집 권한 게이트 아님 → 권한 = 그 공고 `church_id`의 인증 관리자 |
| `title` | text NOT NULL | |
| `job_kind` | text NOT NULL (CHECK) | MINISTRY(사역직)/GENERAL(일반직) — 개교회 채용 구분 |
| `position` | text NULL (CHECK) | 직분 (사역직 MINISTRY만). **아래 XOR CHECK로 MINISTRY면 필수** |
| `role` | text NULL | 일반직 직무(**자유 텍스트 · 통제 목록 아님**): 방송·미디어·행정·시설 등. **XOR CHECK로 GENERAL이면 필수** |
| `department` | text NULL (CHECK) | 부서 |
| `employment_type` | text **NULL** (CHECK) | 고용형태. **NULL=미상** — 원문 언급률 51%뿐이라 NOT NULL이면 승격 시 임의값 강요 |
| `qualification` | text NULL (CHECK) | 자격/경력 요건 (필터). NULL=무관 |
| `headcount` | text NULL | 모집 인원. **int 아님** — "약간명"·"1~2명" 같은 비정형이 흔함 |
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
| `source_url` | text NULL | 원문 링크(운영자 수집). 재호스팅 대신 링크 |
| `contact_email` | text NULL | **지원용 공개 연락처** — 이메일 |
| `contact_tel` | text NULL | 〃 전화 |
| `contact_link` | text NULL | 〃 홈페이지·지원 양식 링크 |
| `contact_post` | text NULL | 〃 우편·방문 접수처(주소) |
| `work_days` | text NULL | 출근 요일·시간(자유 텍스트) |
| `requirements` | text[] DEFAULT '{}' | 자격요건 항목 |
| `preferred` | text[] DEFAULT '{}' | 우대사항 항목 |
| `required_docs` | text[] DEFAULT '{}' | 제출 서류 — **필수** |
| `optional_docs` | text[] DEFAULT '{}' | 제출 서류 — **선택**. 배열 2개로 분리(jsonb `{name,required}`보다 쿼리·표시 단순) |
| `process_steps` | text[] DEFAULT '{}' | 전형 절차(서류→면접→설교…). `requirements`와 동일 패턴 |
| `description` | text **NOT NULL** | 본문(운영자 요약 or 교회 작성 — 원문 통째 복제 X). **요약이 없으면 출처 링크만 있는 빈 껍데기**가 되어 가드레일 #1("요약 + 출처 링크")과 제품의 존재 이유를 부정한다 |
| `featured_tier` | text NOT NULL DEFAULT 'NONE' (CHECK) | 노출 등급 — **현재 유효 노출의 비정규화 캐시**(원장은 `job_promotions`). 결제 완료 Server Action이 쓴다 |
| `featured_until` | date NULL | 노출 만료일 — 〃. 만료 판정은 `today` 인자로(§3 노출 모델) |
| `posted_at` | date **NULL** | 게시일. **NULL = 미상**(PCKWORLD 60건 — 게시판이 날짜를 안 준다). `fetched_at`으로 대체 금지(틀린 날짜 공개). ⚠️ **JSON-LD 생략 + 정렬 폴백 필수** — 위 최소 조건 절의 ⚠️ 3가지 |
| `deadline` | date NULL | 마감(NULL=상시모집) |
| `created_at` | timestamptz DEFAULT now() | |
| `updated_at` | timestamptz DEFAULT now() | Server Action에서 갱신 |

#### `jobs` 테이블 CHECK 제약 (2개)

```sql
-- ① 직분/직무 XOR — 종류에 맞는 쪽이 반드시 있고, 반대쪽은 반드시 비어 있다.
--    "일반직인데 직분이 박힌" 행이 존재 자체로 불가능해진다.
CHECK ( (job_kind = 'MINISTRY' AND position IS NOT NULL AND role     IS NULL)
     OR (job_kind = 'GENERAL'  AND role     IS NOT NULL AND position IS NULL) )

-- ② 연락처 최소 1개 — "어디로 지원하나"를 알 수 없는 공고는 공개할 값이 없다.
--    ⚠️ source_url은 세지 않는다 (아래 근거)
CHECK ( contact_email IS NOT NULL OR contact_tel  IS NOT NULL
     OR contact_link  IS NOT NULL OR contact_post IS NOT NULL )
```

**②에서 `source_url`을 뺀 이유(2026-08-05 확정)**: 세면 크롤링 공고는 `source_url`이 항상 있어 **CHECK가 항상 참 = 장식**이 된다. 빼면 제약이 두 경로에서 각각 일한다 — 크롤링은 연락처를 못 뽑으면 승격이 막혀 **운영자가 원문·포스터를 열어 입력**하게 되고(데이터 품질 상승), 교회 직접 등록은 `source_url`이 NULL이라 자동으로 연락처가 필수다. 연락처를 별도 테이블로 쪼개지 않은 덕에 이 제약이 CHECK 하나로 가능하다(행 간 제약이면 trigger가 필요하고 DB Policy가 금지).

> **막히는 양은 크지 않다(크롤러 실측 3,181건).** 연락 수단 0종이 160건(5.0%)이지만 그 내역이 — 포스터 이미지에 연락처가 있는 것 79건(구조화가 이미지를 읽으면 채워짐) · **"청빙 완료되었습니다" 인사글 등 비채용 글 다수**(크롤러 게이트1에서 탈락, 애초에 승격 후보 아님) · 완전히 빈 공고 3건(`description`이 비어 6번에서 막힘). **승격 후보인데 연락처가 없는 공고는 실제로 극소수다.**

①의 트레이드오프: *"교역자 청빙"* 처럼 직분이 안 적힌 사역직 공고는 `POSITIONS.ETC`("기타")로 넣게 되어 **"기타 직분"과 "직분 미상"이 합쳐진다.** 전수 검수 전제라 운영자가 판단을 강제당하는 게 낫다고 봤다. 구분이 필요해지면 ①에서 `position IS NOT NULL`만 빼고 승격 게이트(앱 검증)로 내린다.

#### 공고가 성립하는 최소 조건 — 필수 4 + CHECK 2 (= 크롤러 승격 판정 규칙)

**크롤러 백업 3,181건 실측으로 검증해 조건을 8개 → 6개로 줄였다(2026-08-05).** "이게 없으면 사역자가 이 공고를 보고 아무 행동도 할 수 없나"가 기준이다.

| | 조건 | 강제 방법 | 실측 근거 |
|---|---|---|---|
| 🔴 | 어느 교회인가 | **`jobs.church_name NOT NULL`** (`church_id`는 nullable) | 교회명 커버율 **96%** — 없는 124건은 이 제약이 자동 차단 |
| 🔴 | 제목 | `jobs.title NOT NULL` | 3,181/3,181 |
| 🔴 | 사역직/일반직 | `jobs.job_kind NOT NULL` | AI 판정, 애매하면 `confidence=low`로 운영자에게 |
| 🔴 | 요약 | `jobs.description NOT NULL` | **빈 공고를 막는 유일한 장치** — 본문·이미지·첨부가 전무한 공고 CSU 53건 + YTUS 1건 실측 |
| 🟡 | 직분 또는 직무 | CHECK ① | 겸직은 운영자 판정으로 |
| 🟡 | 연락처 최소 1개 | CHECK ② | 0종 160건이지만 대부분 비채용 글·포스터 내 연락처 |

+ 시스템 필드 `status`(DEFAULT 'OPEN') · `source` · `featured_tier`(DEFAULT 'NONE') · `pay_period`(DEFAULT 'MONTH') — 항상 INSERT 시점에 알 수 있다.

##### 필수에서 **뺀** 3개 — 게시판이 안 주거나 원문에 없을 수 있는 값

| 필드 | 뺀 이유(실측) | **대신 화면이 해야 할 일** |
|---|---|---|
| `churches.denomination` | 교회 서술 문장에 교단 명시 **2.8%**(CSU만 `order_name` 필드로 83%). 교회 1,004곳을 사람이 채우면 30초씩 8시간 — 비현실 | "교단 미상". `denomination_source`가 `stated`·`registry`·`operator`일 때만 **확정으로 표시**하고 `unknown`·`ai_guess`는 회색/미상 처리 |
| `churches.region` | 광역 81% · 시군구 85% — 나머지 19%는 원문에 없다 | "지역 미상". ⚠️ **지역 필터 선택 시 무조건 탈락**한다(`filter-jobs.ts`가 `region.has(...)`) → 지역은 구직자 1순위 필터라 **사실상 안 보이는 공고**가 된다 |
| `jobs.posted_at` | 게시일 없는 공고 **60건(PCKWORLD)** — 한국기독공보 광고검색은 목록에 날짜가 아예 없다(`list_has_dates: false`). 우리가 못 뽑는 게 아니라 게시판이 안 준다. `fetched_at` 대체는 **틀린 날짜 공개**라 금지 | "게시일 미상" + **아래 ⚠️ 3가지 처리 필수** |

> ⚠️ **`posted_at` nullable의 대가 — 반드시 함께 처리할 3가지.** 이걸 안 하면 SEO가 깨지고 런타임이 터진다:
> 1. **JobPosting JSON-LD 생략** — `lib/seo.ts`가 `datePosted: job.postedAt`을 넣는데 `datePosted`는 **Google JobPosting 필수 필드**다. NULL이면 구조화 데이터가 invalid가 되어 그 공고가 Google Jobs에서 빠지고 Search Console에 오류로 잡힌다 → **NULL이면 JSON-LD 자체를 내지 않는다**(invalid보다 없는 게 낫다).
> 2. **정렬 폴백** — `postedAt`은 정렬·재공고 판정에 10곳 이상에서 쓰이고 `localeCompare`·`reduce`가 NULL에 터진다. `posted_at ?? created_at`으로 폴백한다(대량 승격 시 `created_at`이 뭉쳐 정렬 품질은 떨어진다).
> 3. **타입** — `Job.postedAt: string` → `string | null`, 사용처 전수 null 처리.
>
> 📌 **재검토 여지**: 대안은 `NOT NULL` 유지 + 운영자가 60건 날짜 입력(포스터에 대개 적혀 있어 **≈20분, 1회**)이었다. 위 3가지 영구 비용 + 60건 Google Jobs 제외보다 그게 싸다는 게 검토 의견이었으나, **운영자 결정으로 nullable을 택했다.** 되돌리려면 CHECK 없이 `NOT NULL` 한 줄이다.

> **크롤러가 받는 규칙(한 문장)**: 교회 매칭 · 제목 · `job_kind` · 직분 또는 직무 · 요약 · 연락처 1개 — **이 6개를 못 채우면 승격 불가.** 교단·지역·게시일은 비어도 승격된다. 크롤러는 6개 중 못 채운 게 있으면 `confidence=low`로 표시해 운영자가 먼저 보게 한다(min_job_agent 구조화 단계).
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
>              church_id 채워짐 → 교회 상세·재공고 이력 작동
> ```
>
> **확신 없는 `churches` 행을 만드는 것은 값을 지어내는 것**이고, 그건 위 nullable 원칙("DEFAULT로 값을 지어내지 않는다")과 같은 위반이다. 그리고 이 구조는 **claim을 교회 가입 유인으로 바꾼다**(mock의 `job-101` 클레임 데모가 같은 개념).
>
> **받아들인 대가 4개**:
> 1. **재공고 추적이 claim 전까지 작동하지 않는다** — 우리 차별점인데 크롤링 공고엔 처음엔 없다. 크롤러의 `dedup_key`(끌어올림 묶음)가 부분 보완
> 2. **`/churches/[id]`는 claim된 교회만** 존재한다
> 3. **`jobs.region` 비정규화** — §1 "공고에 교회 속성 복사 안 함"의 **명시적 예외**. `featured_tier`와 같은 취급(캐시된 쿼리가 JOIN 없이 필터·정렬해야 함)
> 4. **교단 필터는 claim 전까지 안 걸린다** — 다만 교단 명시가 2.8%뿐이라 실질 영향은 작다

> ✅ **확정 설계(크롤러 피벗 2026-07-28)**: `job_kind` · `role` · `position` NULL 허용은 개교회 채용 확장(사역직 MINISTRY + 일반직 GENERAL) + 크롤러 `review_data` 정합을 위한 확정 설계다. 마이그레이션 SQL은 별도 작업(deferred).

> ✅ **확정(2026-08-04~05) — 폼이 앞섰던 필드는 모두 컬럼으로 반영.** `/jobs/new` 폼에만 있던 7항목: 모집 인원 → `headcount text` · 부임 시기 → `start_timing text` · 전형 절차 → `process_steps text[]` · **접수 방법 → `contact_email`·`contact_tel`·`contact_link`·`contact_post` 4컬럼** · 제출 서류 필수/선택 → `required_docs` + `optional_docs` 2배열 · 사택 3상태 → **`housing_provided` nullable boolean**(enum 신설 X) + `housing_note` · 처우 비고 → `benefit_note text`. `preferred`(우대사항)는 폼에서 제외됨(자격 요건 자유추가로 흡수). 성별·연령·결혼 컬럼은 두지 않는다(가드레일).
>
> **연락처 = jsonb도 별도 테이블도 아니라 컬럼 4개.** `APPLY_METHODS`가 `ETC` 없는 **닫힌 4키**(EMAIL·LINK·TEL·POST)이고 폼이 `Partial<Record<ApplyMethod, string>>`(방법당 1개)이라 컬럼이 1:1 대응한다 → 타입 안전·파싱 없음·폼 변경 0·JOIN 없음. `church_links`(테이블)와 갈리는 지점은 **집합이 열렸는지**다: `CHURCH_CHANNELS`는 `ETC` 포함 6키에 "채널 추가는 여기에만"이라 열려 있고, 접수 방법은 닫혀 있다. 폐기: `contact text`(대표 1개) · `apply_methods jsonb` — 같은 것을 두 형태로 저장하는 설계였다.
>
> **nullable 원칙 — "없으면 공고가 성립하나?"** 크롤링 원문 3,051건 실측 언급률(2026-08-04): 사택 40% · 전형절차 42% · 부임시기 45% · **고용형태 51%** · 모집인원 65% · 사례비·마감일 75% · 제출서류 88% · 연락처 89% · 자격/경력 90%. 원문 중간값 506자, **11%가 200자 미만**. 따라서:
> - **nullable로 푼다** — 원문에 없을 수 있고 없어도 공고가 성립하는 것: `employment_type`(51%) · `housing_provided`(40%) · `churches.denomination`(미상·무소속 실재) · 위 신규 컬럼 전부. **DEFAULT로 값을 지어내지 않는다** — "언급 없음"을 "미제공"으로 바꾸면 우리가 틀린 정보를 생산한다.
> - **NOT NULL·CHECK로 조인다** — 위 "최소 조건 — 필수 4 + CHECK 2". 여기선 제약이 **품질 게이트**로 작동해 승격 판정을 DB가 대신한다.
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
| `status` | text NOT NULL CHECK | PAID/REFUNDED/CANCELLED |
| `created_at` | timestamptz DEFAULT now() | |

> **왜 `jobs.featured_tier`와 둘 다 두는가.** 역할이 다르다 — 이 테이블은 **영수증 뭉치**(지우지 않음), `jobs`의 두 컬럼은 **"지금 이 공고는 HERO다"라는 비정규화 캐시**다. 원장만 두면 목록 한 페이지(공고 100개)를 그릴 때마다 "각 공고에 오늘 유효한 영수증이 있나"를 계산해야 하는데, `featured_tier`는 `filter-jobs.ts`의 **정렬 1차 키**로 최다 조회 경로다. 게다가 **`'use cache'` 안에서는 `new Date()`가 금지**라 캐시된 쿼리가 "오늘"을 알 수 없다. 그래서 결제 완료 Server Action이 캐시 컬럼을 미리 써준다(CLAUDE.md "집계·판정은 Server Action/query에서").
>
> **원장이 필요한 이유 4가지**: ① 주문·결제 이력(칼럼 2개는 현재 상태만 담아 이력 소실) ② 한 공고가 여러 번 구매(4주 쓰고 또 4주) ③ **`HERO`는 "구좌 한정"** 상품이라 "9월 첫째 주가 찼나"를 알려면 기간 행이 필요 — 칼럼만으론 미래 판매 불가 ④ 환불·정산 대응(KCP 월 4회 정산).
>
> **만료 강등 = `today` 인자 패턴.** 캐시 안에서 "오늘"을 만들 수 없지만 밖에서 넣어줄 수는 있다 — 페이지가 `getListJobs("2026-08-05")`로 날짜를 넘기면 그 인자가 캐시 키가 되어 **하루에 캐시 1개**가 생기고, 자정이 지나면 새 키로 만료가 자동 반영된다(Cron 불필요). **`deadline` 지난 공고가 "모집중"으로 뜨는 문제(ROADMAP 1-5)와 원인·해법이 같아** 한 번에 정리된다.

### `users` — 계정 프로필 (Supabase `auth.users`와 1:1)

> **단일 계정 모델**: 모든 계정은 기본 **사역자(MINISTER)** — 배타적 role 없음. 검색·북마크·관심 교회는 누구나. **교회 인증(증빙 서류 + 운영자 승인)을 통과하면** 같은 계정에 **교회(CHURCH) view가 열려** 자기 교회 공고를 관리. "교회 전용 계정"은 없다(교회는 `churches` 엔티티, 사람 계정은 관리 자격).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK, FK→`auth.users.id` ON DELETE CASCADE | |
| `email` | text **NOT NULL** | `auth.users`에서 복제. `auth` 스키마는 PostgREST로 JOIN하기 어려워 표시·운영자 조회용으로 둔다 |
| `church_id` | uuid FK→churches NULL | 이 계정이 관리하는 교회(인증 후 연결). NULL=일반 사역자 |
| `church_verification_status` | text NULL (CHECK) | PENDING/APPROVED/REJECTED. NULL=미신청 |
| `verification_doc_path` | text NULL | 증빙(고유번호증/사업자등록증) **비공개 Storage 경로**. 보관·파기 정책은 개인정보 검토와 연결(§11) |
| `created_at` | timestamptz DEFAULT now() | |

- **교회 view 개방 조건** = `church_id IS NOT NULL AND church_verification_status='APPROVED'` → 파생 `hasChurchAccess`.
- **다중 담당자**: 여러 user가 같은 `church_id`(다대일) → 한 교회에 담당자 여럿. 권한은 "그 교회 인증 관리자인가"로 판정(공고 owner 일치 X). Phase 1은 각자 독립 인증, 초대형은 Phase 2(→ `church_members` 조인 테이블로 승격).
- **이동**: 담당자가 다른 교회로 옮기면 기존 링크 해제(그 교회 공고는 `owner_id NULL`로 교회에 잔류·운영자 관리 가능·재공고 이력 보존) → 새 교회 재인증. 인증은 **교회별**.
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
   │ 1:N
   ▼
jobs ── owner_id ─▶ users        (작성자, nullable — 권한 게이트 아님)
   ▲
   │ N:1 (bookmarks)
users ──▶ bookmarks ◀── jobs     (Phase 2)
```
- **공고 소유 = 교회 엔티티(`jobs.church_id`)**. `owner_id`는 작성자 기록용 — **편집 권한은 그 교회의 인증 관리자 여부로 판정**(owner 일치 X). 운영자 등록=`owner_id NULL`/`source=OPERATOR`, 교회 등록=`owner_id`=작성 user/`source=CHURCH`.
- **교회 관리 링크**: 인증 승인 시 `users.church_id` 연결(다대일 → 다중 담당자). 담당자 이동 = 링크 해제(공고는 교회 잔류·owner NULL) → 새 교회 재인증. 인증은 교회별.

---

## 5. 인덱스

- `jobs(status)` — 대부분 쿼리가 OPEN 필터
- `jobs(church_id)` — 교회별 공고 / 재공고 / 교회 상세
- `jobs(posted_at DESC)` — 최신순 정렬
- `jobs(featured_tier, featured_until)` — 노출(프리미엄·대표광고) 조회
- `job_promotions(job_id)` — 공고별 결제 이력
- `job_promotions(tier, starts_at, ends_at)` — HERO 구좌 잔여 판정(특정 주가 찼는지)
- `jobs(position)`, `jobs(department)`, `jobs(employment_type)` — 목록 필터
- `jobs(region)` — **지역 필터(최다 사용)**. `church_id`가 NULL일 수 있어 JOIN이 아니라 이 컬럼으로 건다
- `jobs(church_id)` — 교회별 공고·재공고(claim된 것만)
- `churches(denomination)`, `churches(region)` — 교회 상세·교단 필터(JOIN 대상)
- `church_links(church_id)`
- `bookmarks(user_id)`

---

## 6. 재공고 추적 (차별점)

- **식별 키** = `church_id + position + department` (같은 교회의 같은 자리). `lib/repost-tracking.ts` `repostKey()`.
- **DB 컬럼 없음** — query에서 계산(같은 키 공고를 그룹핑). `getRepostInfo`(단건 배지), `groupByRole`(교회 타임라인).
- 재공고 판정 = 같은 자리 **2회 이상**(`REPOST_MIN_COUNT=2`).
- **마감(CLOSED) 공고도 집계·공개** — 재공고 이력·교회 타임라인의 근거(§9 참조).
- 교회 dedup: 운영자 수집 시 기존 교회 **수기 매칭**(없으면 생성). 교회 계정은 가입 시 연결이라 dedup 불필요. (드문 중복은 운영자 수동 병합)

---

## 7. 노출(광고) 모델 — 프리미엄·대표광고 2종

- **저장은 2군데** — 원장 `job_promotions`(결제 이력·구좌 판정) + 캐시 `jobs.featured_tier`·`featured_until`(현재 유효 노출). 근거는 §3 `job_promotions`.
  - **프리미엄**(PREMIUM) = 목록 상단 고정 + 강조 배지
  - **대표광고**(HERO) = 홈·목록 최상단 추천(AD) 슬롯, 더 크게. **구좌 한정** → 특정 주가 찼는지는 `job_promotions`의 기간 행으로 판정(캐시 컬럼으로는 미래 판매 불가)
- **만료 자동 강등 = `today` 인자 패턴.** ⚠️ **`'use cache'` 안에서 `now()`를 쓸 수 없다**(비결정적 값 금지 — 캐시 시점에 얼어붙는다). 대신 페이지가 오늘 날짜를 인자로 넘긴다:
  ```ts
  const jobs = await getListJobs("2026-08-05");   // 캐시 밖에서 오늘을 만든다
  // 캐시 안: featured_until < today 면 NONE 취급 — 인자가 캐시 키라 하루 1캐시
  ```
  자정이 지나면 새 캐시 키가 생겨 만료가 자동 반영된다(Cron·배치 불필요). **`deadline` 지난 공고가 "모집중"으로 뜨는 문제와 원인·해법이 같다**(ROADMAP 1-5) → 같은 인자로 함께 해결.
- **정렬 반영**: 노출 등급 우선 → 최신순(`posted_at`). (끌어올리기/bump 없음 — 저볼륨이라 제외)
- **가격은 확정**(`EXPOSURE_PRODUCTS` 단일 소스: PREMIUM 주 7만/4주 24만 · HERO 주 15만/4주 50만, VAT 포함). 결제·서버 검증 구현 완료, **실카드결제 활성(2026-08-05)**. `/pricing`은 아직 "문의" — 교회 멤버십 미배선으로 결제 경로에 도달 불가(ROADMAP 1-8·8).
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
| `jobs` | **public (OPEN + CLOSED 모두)** ← 재공고 이력·교회 타임라인이 마감 공고 노출 | **인증 관리자(그 공고 church_id)** + operator(전체, owner NULL 포함) |
| `churches` · `church_links` · `church_photos` | public | operator (+ 인증 관리자가 자기 교회 row) |
| `users` | 본인 | 본인 (`church_verification_status`는 운영자만 승인/변경) |
| `job_promotions` | **본인 교회 공고만**(결제 이력 = 그 교회 것) + operator | **INSERT는 Server Action(service-role)만** — 결제 검증 통과 후. UPDATE/DELETE 없음(append-only 원장, 환불은 `status` 변경으로 operator만) |
| `bookmarks` | 본인 | 본인 |

- `lib/supabase/service.ts`(service-role)는 RLS 우회 — **공개 cached read 전용**(공개 공고/교회 조회).
- 인증·권한 필요한 작업은 `server.ts`(anon+쿠키). Server Action에서만 mutation.

---

## 10. 구조화(ingest) 정책

- **수집 경로 2가지(2026-07-28 재정의)**: ① **크롤러(`min_job_agent`)가 공개 공식 게시판(신학교·교단, 31곳)에서 자동 수집** ② **사람이 붙여넣은 텍스트**. 두 경로 모두 → AI 구조화 → **리뷰 큐(`review_data`) → 운영자 검수·승격**. "자동 크롤러 없음" 원칙은 **"공개 공식 게시판 대상 크롤러 + 사람 게이트(운영자 검수 없이는 절대 공개 X)"**로 재정의(가드레일 #1 갱신, 법률 검토 완료 2026-07-28). 상업·비공식 출처는 여전히 배제(가드레일 #4).
- 운영자 등록 = `source=OPERATOR`, `owner_id NULL`. 교회 매칭은 기존 교회 선택/생성(크롤러는 `review_data.matched_church_id` 후보 제시).
- **지원용 공개 연락처(`contact`)는 저장·공개** — 교회가 지원받으려 공개한 전화·이메일·지원 링크만. 지원과 무관한 제3자 개인정보는 저장·노출하지 않음(가드레일 #3 갱신). 그 외 교회 공개 채널(`church_links`)·원문 링크(`source_url`)로도 안내.
- 크롤러 staging 4테이블(§12)은 `min_job_agent`가 소유. min_job은 `review_data`를 admin 검수 브릿지로 **읽어** 승격만 한다(직접 생성·변경 X).

---

## 11. 미확정 (추후 확정)

- **노출 상품 상세** — 가격·기간·묶음할인·부가세·결제 수단 (Phase 2, ROADMAP 2-3)
- **크롤러 수집 적법성** — ✅ **법률 검토 확인 완료 2026-07-28**(공개 공식 게시판 대상 크롤러 전제). 이 전제로 가드레일 #1 재정의(§1·§10)·크롤러(`min_job_agent`) 가동. (로그인 티어 소스는 별도 게이트 — min_job_agent CONTRACT §6)
- **이용약관·개인정보처리방침** — 현재 초안, **정식 운영 전 법률 검토 필수** (ROADMAP 1-6). privacy의 수집항목·위탁·보유기간은 검토 시 스키마와 정합 확인(크롤러 수집 적법성과는 별개 항목)- **enum/type 공유 방식** — min_job `constants/domain.ts`·`types/domain.ts`의 도메인 enum·타입을 크롤러(`min_job_agent`)가 어떻게 공유할지(copy / npm package / path 참조) 미정
- **자동 결제 연동** (Phase 3)
- **인재 DB**(`minister_profiles`, 계정에 1:1) — 사역자 프로필 (Phase 3, 개인정보 동의). "구직 중" opt-in 노출 + "제외 교회"(자기 교회엔 숨김)
- **관심 교회 팔로우**(`church_follows`) + 재공고 알림 (Phase 2, 사역자 view)
- **교회 인증 증빙 문서 보관·파기 정책** (`users.verification_doc_path` — 개인정보 검토와 함께 확정)

---

## 12. 크롤러 staging (min_job_agent 소유)

> 자매 리포 **`min_job_agent`**(크롤러)가 공개 공식 게시판에서 수집·구조화한 초안을 쌓는 **스테이징 4테이블**. 물리적으로는 min_job Supabase 프로젝트에 함께 살지만 **소유·정의·마이그레이션은 전부 `min_job_agent`**. min_job은 이 테이블을 **인지하고 충돌만 회피**한다 — 생성·변경·마이그레이션·RLS를 만들지 않는다(테이블명·마이그레이션 파일 충돌 회피만). **상세 정본 = `../min_job_agent/docs/SPEC.md` §6.**

| 테이블 | 역할 |
|---|---|
| `source_data` | 원자료 + 원장 (불변·write-once·누적). `raw_text`·`raw_meta` + `UNIQUE(source_key, external_id)`로 증분·중복 방지 |
| `review_data` | 구조화 초안 + 검수 (가변). **min_job admin 검수 브릿지가 소비** — PENDING을 읽어 운영자가 검수·승격 |
| `source_health` | 게시판별 상태 (약 31행, 매 실행 UPSERT) — 마지막 실행·성공·신규건수·연속실패 |
| `crawl_run` | 실행별 요약 (1실행 1행, 누적) — started/finished·mode·성공/실패 소스·신규 집계 |

- **RLS = 운영자 전용**(min_job admin이 대시보드·검수에 read), 크롤러는 service-role로 write. **public 노출 없음.**
- **승격 흐름**: admin 검수 UI가 `review_data`(PENDING)를 읽어 → 운영자 승인 시 **요약 + `source_url`·연락처 4컬럼 + `source=OPERATOR`·`owner_id=NULL`**로 `churches`/`jobs`에 INSERT(§10). 검수 메타는 넘기지 않음. **교단은 미상이면 `NULL`로 그대로 승격**(2026-08-05 — 과거 "승격 전 10키로 해소" 규칙은 철회). **지역·게시일도 미상이면 NULL로 승격**(2026-08-05 실데이터 검증). 승격 가능 여부는 §3 "최소 조건 — 필수 4 + CHECK 2"가 판정한다.
- **`review_data` 주요 컬럼**(검수 브릿지가 읽는 것): `job_kind`·`role`·`title`·`position`·`department`·`employment_type`·`stipend_*` · `denomination`(+`denomination_source`·`denomination_evidence`·`raw_denomination` · **미상 가능**) · `contact` · `confidence` · `dedup_key` · `review_status`(PENDING/APPROVED/REJECTED) · `matched_church_id` FK→churches · `published_job_id` FK→jobs · `heresy_flag` 등. **전체 스키마·판정 정본은 min_job_agent SPEC §6.**
- ⚠️ **크로스 리포 동기화 필요(2026-08-05)** — 이번 스키마 확정으로 `review_data`와 어긋나는 지점 4개. `review_data`는 min_job_agent 소유라 우리가 바꾸지 않고 **승격 시 매핑**하거나 크롤러 쪽에 반영을 요청한다:
  1. `stipend_*` → **`pay_*`** 개명 (min_job은 완료)
  2. `contact` 단일 → **`contact_email`·`contact_tel`·`contact_link`·`contact_post`** 4컬럼 분해
  3. `denomination` **미상 = NULL**(ETC 아님) — "미상 교단은 승격 전 해소" 규칙은 **철회**됐다(무소속·독립교회가 실재)
  4. 승격 게이트 = **필수 4 + CHECK 2**(§3 jobs). 크롤러가 맞춰야 하는 6개: 교회 매칭 · 제목 · job_kind · 직분 또는 직무 · 요약 · **연락처 1개**(source_url은 안 셈). 교단·지역·게시일은 비어도 승격 가능
