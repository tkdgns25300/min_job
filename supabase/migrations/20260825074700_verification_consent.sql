-- 교회 인증 신청의 **동의 기록**을 남긴다. 그리고 동의 없는 신청이 존재할 수 없게 만든다.
--
-- 신청 폼은 필수 체크박스로 약관·개인정보 수집 동의를 받는데 **그 사실이 어디에도 저장되지
-- 않았다.** 인증 신청은 로그인 시점 동의(로그인 페이지 고지)와 별개다 — 증빙 서류·담당자 실명
-- 같은 **추가 개인정보**를 받는 자리라 그 동의를 따로 받고 따로 남겨야 한다.
--
-- 두 칸인 이유: 분쟁 때 필요한 것은 "언제"만이 아니라 **"무엇에"** 동의했는지다. 방침 내용은
-- 시행일로 고정되므로(`constants/business.ts`의 `LEGAL_EFFECTIVE_DATE`) 그 값을 함께 박아 둔다.
-- 방침이 개정되면 이 값으로 **재동의가 필요한 신청을 골라낼 수 있다** — 실제로 2026-08-25에
-- 증빙 서류 보유 기간이 개정됐고, 그때 이미 접수된 신청이 있었다면 이 칸 없이는 구분이 안 된다.
--
-- ⚠️ **`users_submitted_needs_consent`가 이 마이그레이션의 핵심이다.** 앱이 실수로 동의를
--    확인하지 않아도 DB가 거부한다 — 공개 방침이 약속한 것을 코드가 아니라 제약이 지킨다
--    (`users_rejected_needs_reason`과 같은 계열).
-- 동의 시점을 `verification_submitted_at`으로 겸용하지 않는 이유: 겸용하면 "접수됐으니 동의한
--    것으로 본다"는 **추론**이 되고, 나중에 접수 없이 동의만 받는 흐름(재동의)이 생기면 무너진다.

alter table users add column verification_consent_at timestamptz;
alter table users add column verification_consent_version text;

-- 시각과 버전은 짝이다 — 하나만 있으면 "무엇에 동의했는지" 또는 "언제"를 잃는다
alter table users
  add constraint users_consent_pairs_with_version
  check ((verification_consent_at is null) = (verification_consent_version is null));

-- 방침 시행일 형식(YYYY-MM-DD) — 자유 텍스트로 두면 버전 비교가 성립하지 않는다
alter table users
  add constraint users_consent_version_format
  check (
    verification_consent_version is null
    or verification_consent_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  );

-- 동의 없는 신청은 존재할 수 없다
alter table users
  add constraint users_submitted_needs_consent
  check (verification_submitted_at is null or verification_consent_at is not null);

-- 교회명 빈 문자열 거부.
-- `NOT NULL`은 `''`를 막지 못한다 — `jobs.source_url`에서 이미 당한 함정이고(마이그레이션
-- `20260820234934`) 결과가 같다: 이름 없는 교회 행이 조용히 생기고 공고 카드·교회 상세가
-- 빈 제목으로 나간다. 액션도 trim 검증을 하지만, 교회 행을 만드는 경로가 늘면 그 검증이
-- 빠질 수 있어 제약으로 못 박는다.
alter table churches
  add constraint churches_name_not_blank
  check (length(btrim(name)) > 0);
