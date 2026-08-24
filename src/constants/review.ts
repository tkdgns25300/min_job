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

/**
 * 구조화가 **내용을 읽을 수 있는** 첨부 확장자 — 크롤러는 이미지만 Gemini에 보내고, 나머지는
 * URL만 검수로 넘긴다(크롤러 SPEC §6 `attachments`). 그래서 이 목록은 "포스터로 읽혔을 수 있다"의
 * 판정이다.
 *
 * ⚠️ **파일명으로 "공고문 / 지원 양식"을 가르지 않는다.** 크롤러 실측에서 289건 중 24건이
 *    두 키워드에 동시 매치했다(`교역자 초빙 서류.hwp`). 우리도 같은 실수를 반복하지 않고,
 *    "읽었는가"만 확장자로 가른 뒤 이름은 그대로 보여준다.
 */
export const READABLE_ATTACHMENT_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"] as const;

/**
 * 수집 게시판 이름 — `source_data.source_key` → 한글. 정본은
 * `../min_job_agent/config/sources.json`의 `board_name`이고(31곳), 여기는 **표시용 사본**이다.
 *
 * 사본을 두는 이유: 크롤러는 형제 리포라 런타임에 그 설정을 읽을 수 없고, `source_data`에는
 * 이름 컬럼이 없다(키만 온다). ⚠️ 모르는 키는 **키를 그대로 보여준다**(`boardLabel`) — 새 게시판이
 * 붙었을 때 화면이 비지 않고 "이름을 아직 안 넣었다"가 눈에 보인다.
 */
const SOURCE_BOARDS: Record<string, string> = {
  DAESHIN: "대신대 취업정보",
  CALVIN: "칼빈대 사역취업정보",
  KWANGSHIN: "광신대 구인게시판",
  CSU: "총신대 사역게시판",
  YTUS: "영남신대 취업/초빙",
  PUTS: "장신대 초빙(장신Lounge)",
  HTUS: "호남신대 미니스트리",
  BPU: "부산장신대 청빙취업안내",
  PCK: "예장통합 총회(PCK)",
  SJS: "서울장신대 사역구인정보",
  PCKWORLD: "한국기독공보 광고검색",
  HANIL: "한일장신대 청빙게시판",
  BU: "백석대 대학원 정보나눔터",
  PGAK: "백석총회 사역자구함",
  KTS: "고려신학대학원(KTS) 교역자초빙",
  KOSIN_TH: "고신대 신학과 자유게시판",
  HAPSHIN: "합신대 교역자초빙",
  MTU: "감신대 취업게시판",
  UHS: "협성대 웨슬리 교역자청빙",
  MOKWON: "목원대 신학과 사역지정보",
  HANSEI: "한세대 대학원(영산) 모집/채용",
  STS: "순복음대학원대 청빙및취업",
  KBTUS: "침신대 취업지원 사역자채용",
  KOREABAPTIST: "침례회 총회 목회자청빙",
  KEHC: "기성 총회 성결광장 구인",
  SUNGKYUL: "예성 총회 구인/청빙",
  KAICAM: "KAICAM 독립교회연합회 청빙·청원",
  NAZARENE: "나사렛성결회 목회자청빙",
  TTGU: "횃불트리니티 Job Posting",
  ACTS: "아세아연합신대(아신대) 사역정보",
  WGST: "웨스트민스터신대원 교역자청빙",
};

/** 게시판 표시 이름 — 모르는 키는 키 그대로(위 주석) */
export function boardLabel(sourceKey: string): string {
  return SOURCE_BOARDS[sourceKey] ?? sourceKey;
}

/**
 * `source_data.raw_meta` 중 **공고 내용인 것만** — 게시판이 양식으로 받아 둔 값이다.
 *
 * ⚠️⚠️ **이걸 안 보여주면 검수가 원문을 못 본 것이 된다.** 총신대(CSU)는 공고를 폼으로 받아
 *    교회명·교단·노회·담임목사·지역·주소·부서·모집인원·자격·지원서류·사례비·연락처를 **전부 여기에**
 *    담고 본문(`raw_text`)은 비어 있다(크롤러 SPEC §5 — "포스터 OCR보다 이 값이 정확하다").
 *    실측 2026-08-23: PENDING 76건 중 13건이 CSU이고 **전부 `raw_text`가 없었다.**
 *
 * ⛔ **게시판 배관은 넣지 않는다**(2026-08-23 · 운영자 판단): 조회수·글번호·작성자·게시판 코드·
 *    미리보기 경로는 검수와 무관하고, 목록 제목·목록 날짜는 위의 글 제목·게시일과 같은 값이다.
 *    `status`(진행중)·`category`(목사)도 뺐다 — 게시판이 붙인 분류지 교회가 쓴 내용이 아니다.
 * ⚠️ 그래서 **모르는 키는 화면에 안 나온다.** 새 게시판이 공고 내용을 새 키에 담으면 놓친다 —
 *    그때 알아채는 자리는 "본문이 비었는데 값이 차 있다"이고, 확인 경로는 **게시판 원문 열기**다.
 */
export const SOURCE_FORM_FIELDS: { key: string; label: string }[] = [
  { key: "church_name", label: "교회명" },
  { key: "order_name", label: "교단" },
  { key: "presbytery_name", label: "노회" },
  { key: "senior_pastor", label: "담임목사" },
  { key: "location", label: "지역" },
  { key: "address", label: "주소" },
  { key: "ministry_dept", label: "사역 부서" },
  { key: "number", label: "모집 인원" },
  { key: "certification", label: "자격" },
  { key: "apply_documents", label: "지원 서류" },
  { key: "gratuity", label: "사례비" },
  { key: "email", label: "이메일" },
  { key: "phone", label: "전화" },
  { key: "deadline", label: "마감일" },
];
