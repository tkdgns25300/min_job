-- 노출 상태를 원장 한 곳으로 + 기간을 시작일부터 7일씩으로 (확정 2026-09-03)
--
-- ① `jobs`의 노출 칸 셋을 지운다. 원장 `job_promotions`와 **같은 사실을 두 곳에** 두고 있었다.
--    그 칸을 둔 원래 이유는 "캐시된 목록 쿼리 안에서 `now()`를 못 써 원장을 계산할 수 없다"였는데,
--    seam이 `todayInSeoul()`을 cached scope 안에서 만드는 방식이 자리를 잡아 이유가 사라졌다.
--    원장은 결제 건수만큼이라 작고, `updateTag("jobs")`가 이미 그 캐시를 비운다.
--    딸려 사라지는 것: "한 공고는 창 하나" 제약 · 같은 등급 연장 규칙 · 두 곳 동기화 걱정.
--    ⚠️ `jobs_featured_idx`는 **따로 지우지 않는다** — 두 컬럼으로 만든 인덱스라 DROP COLUMN이 함께 없앤다.
--       (`drop index`를 뒤에 두면 "does not exist"로 파일 전체가 롤백된다)
--
-- ② 월요일 시작 CHECK를 지운다. 월~일 고정이라 목요일에 사면 4일 노출에 1주 값이었다.
--    이제 시작일은 오늘부터 7일 안의 아무 날이고 기간은 그날부터 주수 × 7일이다.
--    `ends_at = starts_at + weeks*7 - 1` CHECK는 그대로 맞으므로 남긴다.
--
-- ③ 인덱스를 판정 모양에 맞춘다 — "오늘 노출 중인 행"과 "이 기간에 겹치는 행" 둘 다 status·기간으로 건다.
--    (원장이 작아 사실상 장식이지만 조회 모양과 어긋난 인덱스를 남겨 두지 않는다)

drop index job_promotions_slot_idx;
create index job_promotions_active_idx on job_promotions (status, starts_at, ends_at);

alter table job_promotions drop constraint job_promotions_starts_monday_check;

alter table jobs
  drop column featured_tier,
  drop column featured_from,
  drop column featured_until;
