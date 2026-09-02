-- jobs.featured_from — 유료 노출 **시작일**(캐시). 정원이 찬 주를 피해 **다음 주부터** 사는 예약이 생기면서 필요해졌다.
--
-- 캐시 컬럼 둘(`featured_tier`·`featured_until`)은 "지금 이 공고는 스페셜이다"를 `now()` 없이 읽는 값인데,
-- 시작일이 없으면 다음 주 예약을 결제한 순간부터 노출로 읽힌다 — 이번 주 정원이 찼는데 넷째 광고가 서고,
-- 먼저 산 교회의 자리가 묽어진다. 그래서 판정은 `featured_from <= today <= featured_until`이다
-- (`lib/job-visibility.ts` `isFeaturedOn`). 원장(`job_promotions.starts_at`)과 함께 써진다.
--
-- NULL 허용 — NONE인 공고는 셋 다 비어 있다(지금 전 행). NULL이면 "시작 제한 없음"으로 읽는다(기존 판정과 같다).
alter table jobs add column featured_from date;
