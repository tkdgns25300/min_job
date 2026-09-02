-- 노출 상품 2단(프리미엄·대표광고) → 사다리 3등급(스페셜·플러스·기본) — 확정 2026-09-02 (DATA §7 · SPEC 수익화 절)
--
-- 바뀌는 것은 허용값 둘(①·②)과 원장 기간 정합성 CHECK 둘(③)이다. 컬럼·인덱스·타입은 그대로다.
-- 데이터 이전 없음 — 적용 시점에 job_promotions는 0행, jobs.featured_tier는 전부 'NONE'(2026-09-03 실측).
-- 생성 타입(src/types/database.ts)은 text 컬럼이라 diff가 없다.

-- ① jobs.featured_tier — 현재 유효 노출의 캐시. NONE은 "노출 없음"이라 남는다.
alter table jobs drop constraint jobs_featured_tier_check;
alter table jobs add constraint jobs_featured_tier_check
  check (featured_tier in ('NONE', 'SPECIAL', 'PLUS', 'BASIC'));

-- ② job_promotions.tier — 원장. 무료는 상품이 아니라 NONE이 없다(EXPOSURE_PRODUCTS와 1:1).
alter table job_promotions drop constraint job_promotions_tier_check;
alter table job_promotions add constraint job_promotions_tier_check
  check (tier in ('SPECIAL', 'PLUS', 'BASIC'));

-- ③ 기간 정합성 — 정원 판정("그 주 스페셜 3건이 찼나")은 원장 행이 **월요일 시작·주 단위**라는
--    전제로 센다. 쓰는 곳은 Server Action 하나지만 거기 버그 한 번이면 정원이 한 칸 새서 초과 판매가
--    난다 → 잘못된 행이 들어올 수 없게 내장 CHECK로 막는다(DB 정책: 트리거·함수 없이 CHECK만).
alter table job_promotions add constraint job_promotions_starts_monday_check
  check (extract(isodow from starts_at) = 1);
alter table job_promotions add constraint job_promotions_period_matches_weeks_check
  check (ends_at = starts_at + (weeks * 7 - 1));
