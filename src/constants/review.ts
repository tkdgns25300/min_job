// 크롤러 스테이징(`review_data`) enum 라벨 — 수집 검수 화면(`/admin/review`) 전용.
//
// ⚠️ **허용값의 정본은 우리가 아니다** — `../min_job_agent/docs/CONTRACT.md` §1이다.
//    `review_data`는 크롤러(min_job_agent) 소유 테이블이라 값을 늘리거나 줄이는 것은 그쪽 일이고,
//    우리는 **표시 라벨만** 붙인다. 여기 키를 추가해도 DB CHECK가 막는다.
// ⚠️ 그래서 `domain.ts`가 아니라 별 파일이다 — 섞어 두면 우리 도메인 enum처럼 보여
//    "값 하나 더 넣자"는 판단을 우리가 하게 된다.
// ⚠️ `confidence`·`denomination_source`만 **소문자**다(크롤러 규약).

/** 검수 상태 — 큐는 `PENDING`만 본다(SPEC 수집 검수 절) */
export const REVIEW_STATUSES = {
  PENDING: "검수 대기",
  APPROVED: "승인",
  REJECTED: "거절",
} as const;
export type ReviewStatus = keyof typeof REVIEW_STATUSES;

/**
 * 구조화 신뢰도 — 라벨은 등급 이름이 아니라 **뜻**이다(크롤러 SPEC §5.7).
 * "medium"이라는 글자는 검수자에게 아무것도 알려주지 않는다.
 * ⚠️ 필터·정렬에 쓰지 않는다 — "왜 여기 왔나"를 보여주는 값이다.
 */
export const CONFIDENCE_LEVELS = {
  high: "확인할 것 없음",
  medium: "보기만 하면 됨",
  low: "손봐야 함",
} as const;
export type ConfidenceLevel = keyof typeof CONFIDENCE_LEVELS;

/** 중복 판정 라벨 — `UNCERTAIN`만 사람이 결정한다(묶음 화면) */
export const DEDUP_STATES = {
  ALONE: "단독",
  MASTER: "대표",
  DUPLICATE: "중복",
  UNCERTAIN: "같은 자리 불확실",
} as const;
export type DedupState = keyof typeof DEDUP_STATES;

/**
 * 거절 사유. ⚠️⚠️ **우리가 쓰는 값은 `OPERATOR` 하나뿐이다.**
 * 나머지 셋은 크롤러가 자동 거절할 때 쓰고 검수 큐에 오지 않는다 — 표시용으로만 둔다.
 * 특히 사람이 판단한 중복에 `DUPLICATE`를 쓰면 **다음 실행이 거절을 풀어 버린다**:
 * 크롤러는 그 값을 자기 판정으로 보고 매번 다시 판단한다(중복 규칙이 실측으로 계속 바뀌어
 * 잘못 거절한 행이 되살아나야 하기 때문). 사람의 결론은 `OPERATOR` + `review_note`로 남긴다.
 */
export const REJECT_REASONS = {
  DUPLICATE: "중복",
  CLOSED: "마감",
  HERESY: "이단",
  OPERATOR: "운영자 판단",
} as const;
export type RejectReason = keyof typeof REJECT_REASONS;

/** 교단 판정 근거 */
export const DENOMINATION_SOURCES = {
  stated: "공고가 명시",
  registry: "교단 명부",
  ai_guess: "AI 추정",
  operator: "사람이 확정",
  unknown: "미상",
} as const;
export type DenominationSource = keyof typeof DENOMINATION_SOURCES;

/**
 * **크롤러가 교단을 공개하는 근거**(SPEC §6.4). 나머지(`ai_guess`·`unknown`)는 값이 있어도 안 나간다.
 * → 검수자가 교단을 고치면 근거도 `operator`로 함께 바꿔야 한다. 안 바꾸면 화면에는 교단이
 *   보이는데 공개된 공고에는 비어 있다.
 */
export const PUBLISHED_DENOMINATION_SOURCES: readonly DenominationSource[] = [
  "stated",
  "registry",
  "operator",
];

/** 1차 게이트 — `NO`는 `review_data`를 만들지 않으므로 화면에 오지 않는다 */
export const CHURCH_RECRUITMENT_VERDICTS = {
  YES: "개교회 채용",
  UNCERTAIN: "개교회 여부 애매",
  NO: "채용 공고 아님",
} as const;
export type ChurchRecruitmentVerdict = keyof typeof CHURCH_RECRUITMENT_VERDICTS;

/** 포스터를 담아 둔 비공개 Storage 버킷 — 화면은 signed URL을 만들어 띄운다(경로 직접 노출 X) */
export const POSTER_BUCKET = "postings";

/** signed URL 유효 시간(초). 검수 한 건에 넉넉하고, 새 나가도 오래 살지 않을 만큼 짧게 */
export const POSTER_URL_TTL_SECONDS = 60 * 30;
