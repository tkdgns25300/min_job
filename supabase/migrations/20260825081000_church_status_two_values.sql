-- `churches.verification_status`에서 `REJECTED`를 뺀다 — 남는 값은 `PENDING`·`APPROVED` 둘.
--
-- 같은 이름이 두 테이블에서 **다른 뜻**이었다:
--   `users.church_verification_status = REJECTED`  → 이 **사람의 신청**이 반려됨(재신청 가능)
--   `churches.verification_status     = REJECTED`  → 이 **교회를 내림**(허위 판명·opt-out)
-- 읽는 사람이 섞는다(실제로 섞였다 · 2026-08-25). 그런데 뒤쪽은 **기능적으로 남는 것이 없다** —
-- 공개 조회가 `APPROVED`만 보므로(§9) 내려야 하면 `PENDING`으로 돌리면 그 순간 내려간다.
-- 구별되는 것은 "아직 안 봤음"과 "봤고 내렸음"뿐이고, 사람 쪽 반려 사유
-- (`users.verification_rejection_reason`)가 이미 그 기록을 갖고 있다.
--
-- ⚠️ 읽는 코드가 없다는 것을 확인하고 지운다 — `churches` 쪽 `REJECTED`를 분기하는 코드는
--    한 줄도 없었고(화면은 `!== 'APPROVED'`로 "미검증"만 표시한다), 행 수는 0이다.
--
-- 그래서 **거부는 사람 쪽에만 있다**: 신청이 반려되면 `users`가 `REJECTED`가 되고 교회 행은
-- `PENDING`으로 남아, 재신청이 같은 행을 다시 쓴다(§3). 교회를 내리는 것은 `PENDING`으로 되돌리기다.

alter table churches
  drop constraint churches_verification_status_check;

alter table churches
  add constraint churches_verification_status_check
  check (verification_status in ('PENDING', 'APPROVED'));
