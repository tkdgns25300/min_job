-- `jobs.status`에서 `PENDING`(검수중)을 뺀다 — 남는 값은 `OPEN`·`CLOSED` 둘.
--
-- 공고 전수 검수를 하지 않기로 했다(2026-08-21). 이 값은 그 검수를 위한 예약값이었다.
--
-- ⚠️ 이 결정은 세 번 뒤집혔다 — 그래서 근거를 남긴다:
--   2026-07-21  전수 검수 안 함 (1인이 다 못 본다)      → PENDING 제거
--   2026-08-05  되돌림 — 운영자가 모든 공고를 검수한다   → PENDING 예약값으로 추가
--   2026-08-21  다시 안 함 — **인증이 이미 게이트다**    → 제거 (이 파일)
--
-- 오늘 근거가 앞선 둘보다 튼튼하다: 공고를 올릴 수 있는 사람은 **교회 인증을 통과한
-- 관리자뿐**이고(증빙 서류 + 운영자 승인), 그 관문을 지난 교회의 공고를 또 보는 것은
-- 이중 게이트다. 크롤 공고는 `review_data`에서 이미 검수를 거치므로 여기서 볼 것이 없다.
-- 즉 "공고를 공개 전에 사람이 본다"는 요구는 **두 입력 경로 모두 이미 충족**돼 있다.
--
-- 안전한 이유: `jobs`가 0건이고, `PENDING`을 쓰는 코드 경로가 없었다(mock 104건도 전부
-- OPEN/CLOSED). 값을 만드는 mutation이 애초에 구현된 적 없다.
--
-- ⚠️ 크롤러(min_job_agent)에 통보 필요 — 그쪽 SPEC이 "status는 OPEN·CLOSED·PENDING
--    세 값"이라 적고 중복 판정에서 `PENDING` 행을 앵커에서 제외한다. 값이 사라지면 그
--    분기가 죽는다(깨지지는 않는다 — 조건이 항상 거짓이 될 뿐이다).

alter table jobs drop constraint jobs_status_check;

alter table jobs
  add constraint jobs_status_check
  check (status in ('OPEN', 'CLOSED'));
