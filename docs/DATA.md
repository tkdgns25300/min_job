# DATA.md — MinJob 데이터 설계

> **DB 스키마·enum·인덱스·RLS·구조화 정책·설계 결정**. 비즈니스 동작은 [`SPEC.md`](./SPEC.md), 아키텍처·컨벤션은 [`../CLAUDE.md`](../CLAUDE.md), 작업은 [`ROADMAP.md`](./ROADMAP.md).
>
> 이 문서는 **mock 단계에서 확정된 스키마**를 정본으로 옮긴 것. 실제 마이그레이션(`supabase/migrations`)·DB 타입 생성은 이 문서를 따른다. (mock: `src/mocks/*.json`, 타입: `src/types/domain.ts`, enum: `src/constants/domain.ts`)
>
> ⚠️ **살아있는 문서.** 페이지 디자인·기능을 고도화하며 필드가 늘면 이 문서·mock 스키마를 **함께 확장**한다. 데이터는 `lib/queries/*`(seam)로만 접근해 mock↔DB 전환 시 페이지 불변.

---

## 1. 설계 원칙

- **DB는 저장 전용.** trigger·custom function·복잡한 default expression 만들지 않는다. ID 발급·timestamp·집계·재공고 판정 등 로직은 전부 Server Action / query 함수. 내장 기능만 사용(`gen_random_uuid()`, `CHECK`, `FK`, array/`jsonb`).
- **정규화 유지 (JOIN).** 교단·지역·규모 필터는 `churches`를 JOIN해서 건다. 비정규화(공고에 교회 속성 복사) 안 함 — 우리 규모(초기 수백~수천)에선 JOIN + `'use cache'` 캐시로 충분. (대규모 인덱스 최적화 필요 시 나중에 재검토)
- **enum = 영어 대문자 key + 한글 라벨.** key는 DB에 저장(값)·URL params에 사용, 표시는 `constants/domain.ts`의 한글 라벨 맵. DB에서는 `CHECK` 제약으로 허용값 강제(별도 enum 타입 대신 `text + CHECK`로 확장 용이하게).
- **컬럼명 = `snake_case`** (DB), 앱(TS)은 `camelCase`. Supabase 생성 타입이 매핑.
- **가드레일 준수**: 공고 owner nullable · 개인 담당자 연락처 컬럼 없음 · source로 출처 구분 · 자동 크롤러 없음(사람 수집 + AI 구조화).

---

## 2. enum 허용값 (`text + CHECK`)

| enum | 컬럼 | 허용값(key) |
|---|---|---|
| **denomination** (교단) | `churches.denomination` | HAPDONG · TONGHAP · BAEKSEOK · GOSIN · HAPSIN · KIJANG · GAMLI · SEONGGYUL · BAPTIST · SUNBOK · ETC |
| **region** (광역) | `churches.region` | SEOUL · GYEONGGI · INCHEON · GANGWON · CHUNGBUK · CHUNGNAM · DAEJEON · SEJONG · GYEONGBUK · GYEONGNAM · DAEGU · ULSAN · BUSAN · JEONBUK · JEONNAM · GWANGJU · JEJU · OVERSEAS |
| **church_size** (규모) | `churches.size` | PLANT · SMALL · MEDIUM · LARGE · `NULL`(미상) |
| **church_channel** (채널) | `church_links.type` | HOMEPAGE · YOUTUBE · INSTAGRAM · FACEBOOK · BAND |
| **position** (직분) | `jobs.position` | ASSOCIATE_PASTOR · EVANGELIST · LICENSED_MINISTER · ETC |
| **department** (부서) | `jobs.department` | INFANT · CHILDREN · YOUTH · YOUNG_ADULT · DISTRICT · WORSHIP · ADMIN · ETC · `NULL` |
| **employment_type** (고용형태) | `jobs.employment_type` | FULL_TIME · SEMI_FULL_TIME · PART_TIME |
| **stipend_period** (사례비 기간) | `jobs.stipend_period` | MONTH(기본) · YEAR |
| **job_status** | `jobs.status` | OPEN(기본) · CLOSED |
| **job_source** (출처) | `jobs.source` | OPERATOR · CHURCH |
| **featured_tier** (노출) | `jobs.featured_tier` | NONE(기본) · PREMIUM · HERO(=대표광고) |
| **user_role** (역할) | `users.role` | SEEKER · CHURCH |

> **직교화 원칙**: 직분(position)·부서(department)·고용형태(employment_type)는 분리된 축. "전임전도사·교육전도사"처럼 섞지 않는다 → 모순 데이터(파트+전임) 불가능.
> **확장**: 값 추가는 `constants/domain.ts` enum + DB `CHECK`만 수정(마이그레이션 1줄). 교단은 개신교 전 교단으로 확장 가능, 초기 거점 = 예장합동·통합.

---

## 3. 테이블

### `churches` — 교회
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK, `gen_random_uuid()` | |
| `name` | text NOT NULL | 교회명 |
| `denomination` | text NOT NULL (CHECK) | 교단 |
| `region` | text NOT NULL (CHECK) | 광역 (필터) |
| `city` | text NULL | 시·군·구 (표시용 자유 텍스트) |
| `size` | text NULL (CHECK) | 규모, NULL=미상 |
| `founded_year` | int NULL | 창립 연도 |
| `created_at` | timestamptz DEFAULT now() | |

### `church_links` — 교회 채널 (1 church : N links)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `church_id` | uuid FK→churches ON DELETE CASCADE | |
| `type` | text NOT NULL (CHECK: church_channel) | HOMEPAGE·YOUTUBE·… |
| `url` | text NOT NULL | |
| — | UNIQUE(`church_id`, `type`) | 채널당 1개 |

> 앱 타입은 `Church.links: {type, url}[]`. 표시 전용 집합이라 채널 타입별 교차 조회 없음 → 정규화 테이블로 무결성 확보. (jsonb 컬럼도 대안이나 CHECK·정렬 관리 위해 테이블 채택)

### `jobs` — 공고 (핵심)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `church_id` | uuid FK→churches | 소속 교회 |
| `owner_id` | uuid FK→users **NULL** | 운영자 등록=NULL (가드레일 #2) |
| `title` | text NOT NULL | |
| `position` | text NOT NULL (CHECK) | 직분 |
| `department` | text NULL (CHECK) | 부서 |
| `employment_type` | text NOT NULL (CHECK) | 고용형태 |
| `stipend_min` | int NULL | 월/연 금액, **만원 단위** |
| `stipend_max` | int NULL | |
| `stipend_note` | text NULL | 비정형 표현("내규에 따름"·"면담 후 결정") 보존 |
| `stipend_period` | text NOT NULL DEFAULT 'MONTH' (CHECK) | MONTH/YEAR |
| `status` | text NOT NULL DEFAULT 'OPEN' (CHECK) | OPEN/CLOSED |
| `source` | text NOT NULL (CHECK) | OPERATOR/CHURCH |
| `source_url` | text NULL | 원문 링크(운영자 수집). 재호스팅 대신 링크 |
| `work_days` | text NULL | 출근 요일·시간(자유 텍스트) |
| `requirements` | text[] DEFAULT '{}' | 자격요건 항목 |
| `preferred` | text[] DEFAULT '{}' | 우대사항 항목 |
| `required_docs` | text[] DEFAULT '{}' | 제출 서류 |
| `description` | text NULL | 본문(운영자 요약 or 교회 작성 — 원문 통째 복제 X) |
| `featured_tier` | text NOT NULL DEFAULT 'NONE' (CHECK) | 노출 등급 |
| `featured_until` | timestamptz NULL | 노출 만료(지나면 강등) |
| `posted_at` | date NOT NULL | 등록일 |
| `deadline` | date NULL | 마감(NULL=상시모집) |
| `created_at` | timestamptz DEFAULT now() | |
| `updated_at` | timestamptz DEFAULT now() | Server Action에서 갱신 |

### `users` — 계정 프로필 (Supabase `auth.users`와 1:1)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK, FK→`auth.users.id` | |
| `email` | text | |
| `role` | text NOT NULL (CHECK: SEEKER/CHURCH) | 운영자는 지금 구분 안 함(별도 처리 Phase 1) |
| `church_id` | uuid FK→churches NULL | **CHURCH 역할**의 소속 교회(가입 시 연결) |
| `created_at` | timestamptz DEFAULT now() | |

> 운영자(admin)는 공개 role로 두지 않는다 — Phase 1에서 별도 식별(예: allowlist/flag). 개인 정보 최소 수집.

### `bookmarks` — 구직자 북마크 (Phase 2)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `user_id` | uuid FK→users | |
| `job_id` | uuid FK→jobs ON DELETE CASCADE | |
| `created_at` | timestamptz DEFAULT now() | |
| — | PK(`user_id`, `job_id`) | |

---

## 4. 관계

```
users (SEEKER/CHURCH)
  └─ church_id ─────────┐ (CHURCH 계정의 교회, nullable)
                        ▼
churches ──1:N──▶ church_links   (교회 채널)
   │
   │ 1:N
   ▼
jobs ── owner_id ─▶ users        (교회 직접 등록 공고의 소유자, nullable)
   ▲
   │ N:1 (bookmarks)
users ──▶ bookmarks ◀── jobs     (Phase 2)
```
- 공고 owner: **운영자 등록** = `owner_id NULL`, `source=OPERATOR` / **교회 직접 등록** = `owner_id`=교회 user, `source=CHURCH`.
- 교회 계정: `users.church_id`로 자기 교회 연결(가입 시). 공고 등록 시 그 교회로.

---

## 5. 인덱스

- `jobs(status)` — 대부분 쿼리가 OPEN 필터
- `jobs(church_id)` — 교회별 공고 / 재공고 / 교회 상세
- `jobs(posted_at DESC)` — 최신순 정렬
- `jobs(featured_tier, featured_until)` — 노출(프리미엄·대표광고) 조회
- `jobs(position)`, `jobs(department)`, `jobs(employment_type)` — 목록 필터
- `churches(denomination)`, `churches(region)`, `churches(size)` — 목록 필터(JOIN 대상)
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

- `featured_tier`(NONE/PREMIUM/HERO) + `featured_until`.
  - **프리미엄**(PREMIUM) = 목록 상단 고정 + 강조 배지
  - **대표광고**(HERO) = 홈·목록 최상단 추천(AD) 슬롯, 더 크게
- **만료 자동 강등**: query에서 `featured_until IS NULL OR featured_until > now()`인 것만 노출로 취급(별도 배치 없이). 기간 = Server Action이 결제 시 `featured_until` 설정.
- **정렬 반영**: 노출 등급 우선 → 최신순(`posted_at`). (끌어올리기/bump 없음 — 저볼륨이라 제외)
- **가격·기간·묶음할인·부가세·결제**는 **미확정 → Phase 2에서 상세 확정**(ROADMAP 2-3). 초기 `/pricing`은 "문의".
- 기독 B2B 배너 광고 = 별도 광고주·ad ops → Phase 2+ 옵션(레일 슬롯만).

---

## 8. 사례비 표현

- `stipend_min` / `stipend_max` (**만원 단위 정수**), `stipend_period`(MONTH/YEAR, 기본 MONTH), `stipend_note`(비정형 보존).
- 표시: 범위(`min~max만원`) / 단일(`min만원`) / 비정형(note) / 없음("협의"). `lib/format.ts` `formatStipend`.
- 비교·정렬 시 period 고려(연봉은 월 환산 등) — 세부 규칙은 Phase 2.

---

## 9. RLS (의도 — 상세 정책은 Phase 1에서 확정)

| 테이블 | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `jobs` | **public (OPEN + CLOSED 모두)** ← 재공고 이력·교회 타임라인이 마감 공고 노출 | owner(교회 자기 공고) + operator(전체, owner NULL 포함) |
| `churches` · `church_links` | public | operator (+ 교회가 자기 교회 row) |
| `users` | 본인 | 본인 |
| `bookmarks` | 본인 | 본인 |

- `lib/supabase/service.ts`(service-role)는 RLS 우회 — **공개 cached read 전용**(공개 공고/교회 조회).
- 인증·권한 필요한 작업은 `server.ts`(anon+쿠키). Server Action에서만 mutation.

---

## 10. 구조화(ingest) 정책

- 입력은 항상 **"사람이 붙여넣은 텍스트"** → AI가 필드로 구조화 → 운영자 검토 후 등록. 외부 사이트 자동 수집 코드 없음(가드레일 #1).
- 운영자 등록 = `source=OPERATOR`, `owner_id NULL`. 교회 매칭은 기존 교회 선택/생성.
- 개인 담당자 연락처는 저장하지 않음 — 교회 공개 채널(`church_links`)·원문 링크(`source_url`)로 안내(가드레일 #3).

---

## 11. 미확정 (추후 확정)

- **노출 상품 상세** — 가격·기간·묶음할인·부가세·결제 수단 (Phase 2, ROADMAP 2-3)
- **이용약관·개인정보처리방침** — 현재 초안, **정식 운영 전 법률 검토 필수** (ROADMAP 1-6). privacy의 수집항목·위탁·보유기간은 검토 시 스키마와 정합 확인
- **자동 결제 연동** (Phase 3)
- **인재 DB**(`seeker_profiles`) — 구직자 프로필 (Phase 3, 개인정보 동의 필요)
