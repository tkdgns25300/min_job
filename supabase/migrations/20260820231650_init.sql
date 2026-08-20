-- MinJob 초기 스키마 — 정본은 docs/DATA.md.
--
-- 범위: CREATE TABLE + 제약 + 인덱스만. **RLS 정책·Storage 버킷은 다음 마이그레이션**이다
--       (RLS는 2026-08-21 결정으로 당분간 유예 · GRANT는 크롤러가 service role이라 쓰지 않는다 — DATA §9).
--       RLS를 여기서 `ENABLE`하지 않는 이유: 정책 없이 켜면 anon·authenticated 접근이 전부 막혀,
--       그 사이 코드를 붙이면 원인을 찾기 어려운 실패가 난다. 켜는 것과 정책을 한 파일에 둔다.
--
-- 설계 원칙(DATA.md §1) — 여기서 지키는 것:
--   · DB는 저장 전용. **trigger·custom function을 만들지 않는다.** ID 발급·timestamp·집계는 전부
--     Server Action / query 함수. 내장 기능만 쓴다(gen_random_uuid · CHECK · FK · array).
--   · enum은 별도 타입이 아니라 **text + CHECK**. 허용값이 늘 때 ALTER TYPE 없이 CHECK만 갈면 된다.
--   · 컬럼명은 snake_case. 앱(TS)은 camelCase이고 Supabase 생성 타입이 매핑한다.
--
-- ⚠️ `updated_at`은 자동으로 갱신되지 않는다(trigger 금지). **UPDATE하는 Server Action이 매번
--    직접 써야 한다** — 안 쓰면 영원히 생성 시각으로 남는다.

-- ───────────────────────────────────────────────────────────────────────────────
-- ① churches — 교회
--    행이 생기는 경로는 하나뿐이다: 교회 인증 신청에서 신규 교회로 적어낸 순간(DATA §3).
--    ⚠️ 크롤 공고는 교회 행을 만들지 않는다 — jobs.church_id = NULL로 들어가고 claim 때 연결된다.
-- ───────────────────────────────────────────────────────────────────────────────
create table churches (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  -- NULL = 미상 또는 무소속·독립교회. ETC("소속은 있고 우리 9키에 없는 교단")와 구분할 것 —
  -- 미상을 ETC에 섞으면 필터·거점 판정이 오염된다.
  denomination        text     check (denomination in (
                        'HAPDONG','TONGHAP','BAEKSEOK','GOSIN','HAPSIN',
                        'GAMLI','SEONGGYUL','BAPTIST','SUNBOK','ETC')),
  -- NULL = 미상. ⚠️ NULL이면 지역 필터에서 무조건 탈락해 사실상 안 보인다(검수에서 먼저 채울 값).
  region              text     check (region in (
                        'SEOUL','GYEONGGI','INCHEON','GANGWON','CHUNGBUK','CHUNGNAM','DAEJEON',
                        'SEJONG','GYEONGBUK','GYEONGNAM','DAEGU','ULSAN','BUSAN','JEONBUK',
                        'JEONNAM','GWANGJU','JEJU','OVERSEAS')),
  city                text,
  -- 주소 원문 그대로 — 도로명/지번을 나누지 않는다(지도 검색은 둘 다 되고, 나누면 오분류가 생긴다).
  address             text,
  founded_year        int,
  -- DEFAULT 'PENDING'은 fail-closed 안전값이다 — 상태를 정하지 않고 만든 행을 비공개로 넘어뜨린다.
  -- 공개 조회는 APPROVED만. REJECTED는 이미 공개된 교회를 허위 판명·opt-out으로 내릴 때.
  verification_status text not null default 'PENDING'
                        check (verification_status in ('PENDING','APPROVED','REJECTED')),
  -- 사무용 연락처 — 인증 검수 때 공개 게시판 공고·홈페이지와 대조하는 근거.
  -- ⚠️ 공개 화면에 렌더하지 않는다(검수 대조용으로 받은 값이다).
  contact_email       text,
  contact_tel         text,
  created_at          timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────────
-- ② church_links — 교회 채널 (1:N)
--    표시 전용 집합이지만 CHECK·정렬 관리를 위해 jsonb 대신 테이블로 둔다(DATA §3).
-- ───────────────────────────────────────────────────────────────────────────────
create table church_links (
  id        uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches (id) on delete cascade,
  type      text not null check (type in (
              'HOMEPAGE','YOUTUBE','INSTAGRAM','FACEBOOK','BAND','ETC')),
  url       text not null,
  unique (church_id, type)   -- 채널당 1개
);

-- ───────────────────────────────────────────────────────────────────────────────
-- ③ church_photos — 교회 사진 (1:N, 순서 있음)
-- ───────────────────────────────────────────────────────────────────────────────
create table church_photos (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references churches (id) on delete cascade,
  url        text not null,          -- Supabase Storage 업로드 URL
  sort_order int  not null default 0 -- 오름차순 표시. 첫 장 = 커버
);

-- ───────────────────────────────────────────────────────────────────────────────
-- ④ users — 계정 프로필 (auth.users와 1:1)
--    ⚠️ 행을 만드는 trigger를 두지 않는다(DB Policy). 로그인 후 코드가 upsert한다.
--    운영자(admin)는 DB 컬럼으로 두지 않는다 — .env ADMIN_EMAILS allowlist로 판정한다.
-- ───────────────────────────────────────────────────────────────────────────────
create table users (
  id                              uuid primary key references auth.users (id) on delete cascade,
  -- auth.users에서 복제. auth 스키마는 PostgREST로 JOIN하기 어려워 표시·운영자 조회용으로 둔다.
  email                           text not null unique,
  -- 이 계정이 관리하는 교회. NULL = 일반 사역자. 다대일 = 한 교회에 담당자 여럿.
  church_id                       uuid references churches (id),
  -- 이 **사람**의 인증 상태. NULL = 미신청. 교회 쪽 상태는 churches.verification_status(다른 사실).
  church_verification_status      text check (church_verification_status in
                                    ('PENDING','APPROVED','REJECTED')),
  -- 증빙(고유번호증/사업자등록증) 비공개 Storage 경로.
  -- ⚠️ 서류의 등록번호·종류는 저장하지 않는다 — 운영자가 파일을 열면 되고, 저장하면 보관 부담만 진다.
  -- ⚠️ 개인정보처리방침이 "인증 처리 완료 후 지체 없이 파기"를 약속했다 → 승인·반려 처리가
  --    파일을 지우고 이 컬럼을 NULL로 돌린다.
  verification_doc_path           text,
  verification_applicant_name     text,   -- 신청자 실명(Google 표시명은 닉네임일 수 있다)
  verification_applicant_position text    check (verification_applicant_position in (
                                    'SENIOR_PASTOR','ASSOCIATE_PASTOR','EVANGELIST',
                                    'LICENSED_MINISTER','ETC')),
  -- 신청자가 적어낸 교회 사무용 연락처. ⚠️ churches.contact_*에 바로 쓰지 않는다 —
  -- 미승인 신청자가 이미 인증된 교회의 대표 연락처를 덮어쓸 수 있다. 승인 시 옮긴다.
  verification_contact_tel        text,
  verification_contact_email      text,
  verification_submitted_at       timestamptz,   -- 검수 큐 정렬(오래된 신청 우선)
  verification_reviewed_at        timestamptz,
  verification_rejection_reason   text,
  created_at                      timestamptz not null default now(),

  -- 승인됐다면 어느 교회인지가 반드시 있어야 한다
  constraint users_approved_needs_church
    check (church_verification_status <> 'APPROVED' or church_id is not null),
  -- 반려됐다면 사유가 반드시 있어야 한다 — 없으면 신청자가 뭘 고쳐야 할지 모른다
  constraint users_rejected_needs_reason
    check (church_verification_status <> 'REJECTED' or verification_rejection_reason is not null)
);

-- ───────────────────────────────────────────────────────────────────────────────
-- ⑤ jobs — 공고 (핵심)
--    공고에 작성자(user) 컬럼을 두지 않는다(가드레일 #2) — 편집 권한은 그 교회의 인증 관리자로 판정.
--    church_name·denomination·region·city·address는 **의도적 비정규화**(DATA §1 예외):
--    church_id가 NULL일 수 있어(크롤 공고) JOIN이 성립하지 않는다.
-- ───────────────────────────────────────────────────────────────────────────────
create table jobs (
  id               uuid primary key default gen_random_uuid(),
  -- NULL = 아직 어느 교회인지 확정 못 함(크롤 공고 기본값). 교회가 claim하면 채워진다.
  -- ⚠️ 이름으로 자동 매칭하지 않는다 — 동명이교회 실측이 있어 남의 교회 공고가 붙는다.
  church_id        uuid references churches (id),
  church_name      text not null,          -- 공고가 말한 그대로
  denomination     text     check (denomination in (
                     'HAPDONG','TONGHAP','BAEKSEOK','GOSIN','HAPSIN',
                     'GAMLI','SEONGGYUL','BAPTIST','SUNBOK','ETC')),
  region           text     check (region in (
                     'SEOUL','GYEONGGI','INCHEON','GANGWON','CHUNGBUK','CHUNGNAM','DAEJEON',
                     'SEJONG','GYEONGBUK','GYEONGNAM','DAEGU','ULSAN','BUSAN','JEONBUK',
                     'JEONNAM','GWANGJU','JEJU','OVERSEAS')),
  city             text,
  address          text,                    -- ⚠️ contact_post(서류 접수처)와 다른 값이다
  title            text not null,

  -- 배열인 이유: 한 글에 자리가 여럿인 공고를 표현해야 한다(DATA §3 판정 규칙).
  -- 필터는 `=`가 아니라 `@> array['...']`로 건다(아래 GIN 인덱스).
  job_kind         text[] not null,
  position         text[],
  role             text,                    -- 일반직 직무. 통제 목록이 아니라 자유 텍스트

  department       text     check (department in (
                     'INFANT','CHILDREN','YOUTH','YOUNG_ADULT','DISTRICT','WORSHIP','ADMIN','ETC')),
  -- NULL = 미상(원문 언급률 51%라 NOT NULL이면 승격 시 임의값을 강요한다)
  employment_type  text     check (employment_type in ('FULL_TIME','SEMI_FULL_TIME','PART_TIME')),
  qualification    text     check (qualification in (
                     'ANY','ENTRY','EXPERIENCED','ORDAINED','SEMINARIAN')),
  headcount        text,                    -- "약간명"·"1~2명" 같은 비정형이 흔해 정수가 아니다
  start_timing     text,                    -- "즉시"·"협의"·"2월 중"
  -- NULL = 언급 없음. false(명시적 미제공)와 다르다 — 언급 없음을 미제공으로 바꾸면 틀린 정보가 된다.
  housing_provided boolean,
  housing_note     text,
  pay_min          int,                     -- 만원 단위
  pay_max          int,
  pay_note         text,                    -- "교회 내규에 따름" 등 비정형을 원문 그대로
  pay_period       text not null default 'MONTH' check (pay_period in ('MONTH','YEAR')),
  benefit_note     text,

  status           text not null default 'OPEN'
                     check (status in ('OPEN','CLOSED','PENDING')),
  source           text not null check (source in ('OPERATOR','CHURCH')),
  source_url       text,                    -- 원문 링크. 재호스팅 대신 링크(가드레일 #1)

  -- 지원용으로 공개된 연락처만 저장·공개한다(가드레일 #3). APPLY_METHODS 닫힌 4키와 1:1.
  contact_email    text,
  contact_tel      text,
  contact_link     text,
  contact_post     text,

  work_days        text,
  requirements     text[] not null default '{}',
  preferred        text[] not null default '{}',
  required_docs    text[] not null default '{}',
  optional_docs    text[] not null default '{}',
  process_steps    text[] not null default '{}',
  description      text not null,           -- **요약**이다. 원문 재게시 금지(가드레일 #1)

  -- 현재 유효 노출의 비정규화 캐시(원장은 job_promotions). 결제 완료가 쓴다.
  featured_tier    text not null default 'NONE'
                     check (featured_tier in ('NONE','PREMIUM','HERO')),
  featured_until   date,
  posted_at        date not null,            -- 만료 판정 기준이라 필수(DATA §6-1)
  deadline         date,                     -- NULL = 상시모집(게시 후 N일까지 노출)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- ① job_kind ↔ position/role 상호 일치(biconditional) — XOR보다 강하다(양방향 차단).
  --    혼합 공고({MINISTRY,GENERAL} + position + role)도 이 형태라야 표현된다.
  --    ⚠️ array_length를 쓰지 말 것 — 빈 배열에 NULL을 반환하고 Postgres CHECK는 NULL을 통과시켜
  --       "직분 없는 사역직 공고"가 그대로 들어온다. cardinality는 빈 배열에 0을 준다.
  constraint jobs_kind_matches_seat check (
        coalesce(cardinality(job_kind), 0) > 0
    and ('MINISTRY' = any (job_kind)) = coalesce(cardinality(position) > 0, false)
    and ('GENERAL'  = any (job_kind)) = (role is not null)
  ),
  -- ② 연락처 최소 1개 — "어디로 지원하나"를 알 수 없는 공고는 공개할 값이 없다.
  --    ⚠️ source_url은 세지 않는다. 세면 크롤 공고는 항상 통과해 제약이 장식이 된다.
  constraint jobs_needs_contact check (
    contact_email is not null or contact_tel  is not null
    or contact_link is not null or contact_post is not null
  ),
  -- ③ 수집 공고엔 원문 링크가 반드시 있다(가드레일 #1의 "요약 + 출처 링크").
  --    교회 직접 등록은 원문이 없으므로 면제.
  constraint jobs_collected_needs_source_url
    check (source = 'CHURCH' or source_url is not null),
  -- ④ 교회가 직접 올린 공고엔 교회 행이 반드시 있다(인증 관리자만 등록할 수 있다).
  --    수집 공고는 church_id가 NULL이다 — 교회 행을 만들지 않는다.
  constraint jobs_church_posted_needs_church
    check (source = 'OPERATOR' or church_id is not null)
);

-- ───────────────────────────────────────────────────────────────────────────────
-- ⑥ job_promotions — 노출 구매 원장 (append-only)
--    jobs.featured_tier와 둘 다 두는 이유: 이건 영수증 뭉치(지우지 않음)이고,
--    jobs의 두 컬럼은 "지금 이 공고는 HERO다"라는 비정규화 캐시다(DATA §3).
--    ⚠️ 두 곳의 동기화는 DB가 강제하지 않는다 — 결제 완료 코드가 함께 써야 한다.
-- ───────────────────────────────────────────────────────────────────────────────
create table job_promotions (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references jobs (id) on delete cascade,
  -- NONE 없음 — 무료는 상품이 아니라 원장에 들어올 수 없다(EXPOSURE_PRODUCTS와 일치).
  tier       text not null check (tier in ('PREMIUM','HERO')),
  weeks      int  not null check (weeks in (1,2,4)),
  amount     int  not null,          -- 원, VAT 포함. exposurePrice(tier, weeks) 재계산값과 대조
  -- PortOne paymentId(38자 — KCP 40자 제한). UNIQUE가 멱등성이다:
  -- /api/payments/complete가 재시도돼도 노출이 두 번 적립되지 않는다.
  payment_id text not null unique,
  starts_at  date not null,
  -- weeks에서 계산 가능하지만 저장한다 — 정산·구좌 조회에 필요하고 계산은 Server Action이 1회.
  ends_at    date not null,
  status     text not null check (status in ('PAID','REFUNDED','CANCELLED')),
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────────
-- ⑦ bookmarks — 사역자 북마크
--    ⚠️ 테이블만 만들어 둔다. 배선 전까지 앱은 localStorage로 동작한다(ROADMAP 1-4).
-- ───────────────────────────────────────────────────────────────────────────────
create table bookmarks (
  user_id    uuid not null references users (id) on delete cascade,
  job_id     uuid not null references jobs  (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 인덱스 (DATA §5)
-- ───────────────────────────────────────────────────────────────────────────────
create index churches_denomination_idx        on churches (denomination);
create index churches_region_idx              on churches (region);
-- 공개 조회가 APPROVED만 거른다
create index churches_verification_status_idx on churches (verification_status);

create index church_links_church_id_idx  on church_links  (church_id);
create index church_photos_church_id_idx on church_photos (church_id);

create index users_church_id_idx                  on users (church_id);
-- 운영자 검수 큐(PENDING 목록)
create index users_church_verification_status_idx on users (church_verification_status);

create index jobs_status_idx          on jobs (status);         -- 대부분 쿼리가 OPEN 필터
create index jobs_posted_at_idx       on jobs (posted_at desc); -- 최신순 정렬(유일한 정렬)
create index jobs_church_id_idx       on jobs (church_id);      -- 교회별 공고(claim된 것만)
-- 지역·교단 필터. church_id가 NULL일 수 있어 JOIN이 아니라 이 컬럼으로 건다(§1 예외)
create index jobs_region_idx          on jobs (region);
create index jobs_denomination_idx    on jobs (denomination);
create index jobs_department_idx      on jobs (department);
create index jobs_employment_type_idx on jobs (employment_type);
create index jobs_featured_idx        on jobs (featured_tier, featured_until);
-- 배열 컬럼 — 필터가 `@> array['EVANGELIST']` 형태라 B-tree가 걸리지 않는다
create index jobs_job_kind_gin_idx    on jobs using gin (job_kind);
create index jobs_position_gin_idx    on jobs using gin (position);

create index job_promotions_job_id_idx on job_promotions (job_id);
-- HERO 구좌 잔여 판정(특정 주가 찼는지)
create index job_promotions_slot_idx   on job_promotions (tier, starts_at, ends_at);

create index bookmarks_user_id_idx on bookmarks (user_id);
