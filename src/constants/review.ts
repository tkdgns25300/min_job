// 크롤러 소유 값(`review_data` enum 라벨 · 게시판 이름 · 수집 주기) — 수집 검수 화면과 운영자 홈이 쓴다.
//
// ⚠️ **허용값의 정본은 우리가 아니다** — `../min_job_agent/docs/CONTRACT.md` §1이다.
//    `review_data`는 크롤러(min_job_agent) 소유 테이블이라 값을 늘리거나 줄이는 것은 그쪽 일이고,
//    우리는 **표시 라벨만** 붙인다. 여기 키를 추가해도 DB CHECK가 막는다.
// ⚠️ 그래서 `domain.ts`가 아니라 별 파일이다 — 섞어 두면 우리 도메인 enum처럼 보여
//    "값 하나 더 넣자"는 판단을 우리가 하게 된다.
// ⚠️ `confidence`·`denomination_source`만 **소문자**다(크롤러 규약).

/**
 * 마지막 수집이 이만큼 지나면 운영자 홈이 "봐야 할 것"으로 표시한다(시간). **크롤 주기 한 번**이다.
 *
 * ⚠️ **우리가 고른 판정이 아니라 크롤 일정에서 나온 값**이라 여기 있다(`domain.ts`가 아니라).
 *    주기가 바뀌면 이 값도 같이 바꾼다.
 * ⚠️ **여유를 두지 않은 것은 선택이다(운영자 확정 2026-08-25).** 지금은 크롤러를 손으로 돌려 실행
 *    시각이 흔들리므로(실측 17:01~18:04), 어제보다 늦게 돌린 날은 그 차이만큼 아무 이상 없이
 *    금색이 된다. 그 대가를 받아들인 이유는 **거른 날을 그날 안에 아는 쪽이 낫기 때문**이다 —
 *    여유를 한 주기 주면 크롤러가 죽어도 이틀 뒤에야 표시된다. **매일 07:00 cron**이 올라오면
 *    (min_job_agent ROADMAP 1-7) 흔들림 자체가 사라진다.
 * ⛔ 이것이 크롤러 경보(`alerts_for`)의 사본이 아닌 이유: 크롤러는 **자기가 안 돌았다는 사실을 스스로
 *    기록할 수 없다**(프로세스가 안 뜨면 아무것도 쓰지 않는다). 그쪽이 답할 수 없는 유일한 질문이다.
 */
export const CRAWL_OVERDUE_HOURS = 24;

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
 * 사본을 두는 이유(이름·목록 주소): 크롤러는 형제 리포라 런타임에 그 설정을 읽을 수 없고, `source_data`에는
 * 이름 컬럼이 없다(키만 온다). ⚠️ 모르는 키는 **키를 그대로 보여준다**(`boardLabel`) — 새 게시판이
 * 붙었을 때 화면이 비지 않고 "이름을 아직 안 넣었다"가 눈에 보인다.
 */
const SOURCE_BOARDS: Record<string, { label: string; url: string }> = {
  DAESHIN: { label: "대신대 취업정보", url: "https://daeshin.ac.kr/html/05_community/03.php" },
  CALVIN: {
    label: "칼빈대 사역취업정보",
    url: "http://calvin.ac.kr/main/boardList.do?brd_mgrno=692&menu_no=2282",
  },
  KWANGSHIN: {
    label: "광신대 구인게시판",
    url: "https://www.kwangshin.ac.kr/front/boardList.do?brd_mgrno=184&menu_no=467",
  },
  CSU: { label: "총신대 사역게시판", url: "https://csu.ac.kr/?m1=page&menu_id=1110" },
  YTUS: { label: "영남신대 취업/초빙", url: "https://www.ytus.ac.kr/board/list/trXXR" },
  PUTS: {
    label: "장신대 초빙(장신Lounge)",
    url: "https://puts.ac.kr/www/board/list.general.asp?bd_name=jangshin_jboard04",
  },
  HTUS: {
    label: "호남신대 미니스트리",
    url: "https://ministry.htus.ac.kr/board/board.php?b_id=ministry_009",
  },
  BPU: {
    label: "부산장신대 청빙취업안내",
    url: "https://www.bpu.ac.kr/Board/BoardList.aspx?BoardMstNo=6&CategoryNo=1",
  },
  PCK: { label: "예장통합 총회(PCK)", url: "https://pck.or.kr/bbs/board.php?bo_table=SM05_05" },
  SJS: { label: "서울장신대 사역구인정보", url: "https://sjs.ac.kr/ht_ml/w_04ed/4600.php" },
  PCKWORLD: { label: "한국기독공보 광고검색", url: "https://pckworld.com/adsearch/" },
  HANIL: {
    label: "한일장신대 청빙게시판",
    url: "https://www.hanil.ac.kr/portal/default/bbs/list.do?menuId=M0004000500000000",
  },
  BU: {
    label: "백석대 대학원 정보나눔터",
    url: "https://community.bu.ac.kr/graduateschool/3938/subview.do",
  },
  PGAK: {
    label: "백석총회 사역자구함",
    url: "https://pgak.net/sys-infra/components/board/list.asp?skin=basic&boardid=B5FF8",
  },
  KTS: { label: "고려신학대학원(KTS) 교역자초빙", url: "https://www.kts.ac.kr/home/pinvit" },
  KOSIN_TH: {
    label: "고신대 신학과 자유게시판",
    url: "https://best.kosin.ac.kr/th/index.php?pCode=MN6000030&mode=list",
  },
  HAPSHIN: { label: "합신대 교역자초빙", url: "https://hapdong.ac.kr/bbs/board.php?bo_table=e03" },
  MTU: { label: "감신대 취업게시판", url: "https://www.mtu.ac.kr/mtu/board/list.do?mId=162" },
  UHS: { label: "협성대 웨슬리 교역자청빙", url: "https://www.uhs.ac.kr/gsthe/2386/subview.do" },
  MOKWON: {
    label: "목원대 신학과 사역지정보",
    url: "https://mokwon.ac.kr/mt1954/html/sub06/0602.html",
  },
  HANSEI: {
    label: "한세대 대학원(영산) 모집/채용",
    url: "https://graduate.hansei.ac.kr/graduated/644/subview.do",
  },
  STS: { label: "순복음대학원대 청빙및취업", url: "https://sts.ac.kr/main/sub.html?pageCode=38" },
  KBTUS: {
    label: "침신대 취업지원 사역자채용",
    url: "https://job.kbtus.ac.kr/job/CMS/Board/Board.do?mCode=MN014",
  },
  KOREABAPTIST: {
    label: "침례회 총회 목회자청빙",
    url: "https://koreabaptist.or.kr/Board/Index/21317",
  },
  KEHC: { label: "기성 총회 성결광장 구인", url: "https://kehc.org/home/recruit/view_list/page/0" },
  SUNGKYUL: {
    label: "예성 총회 구인/청빙",
    url: "https://sungkyul.org/NOS-Board/bbs.php?idx=com9",
  },
  KAICAM: {
    label: "KAICAM 독립교회연합회 청빙·청원",
    url: "https://home.kaicam.org/webchon.layout/board/white2022/list.asp?boardid=D9537",
  },
  NAZARENE: { label: "나사렛성결회 목회자청빙", url: "https://na.or.kr/ccall" },
  TTGU: {
    label: "횃불트리니티 Job Posting",
    url: "https://www.ttgu.ac.kr/index.php?mid=ttgu_board_03",
  },
  ACTS: {
    label: "아세아연합신대(아신대) 사역정보",
    url: "https://www.acts.ac.kr/modules/board/bd_list.asp?id=acts_csrd_guide&ca_no=1",
  },
  WGST: {
    label: "웨스트민스터신대원 교역자청빙",
    url: "http://www.wgst.ac.kr/wgst_renew/board/board.asp?key=6131",
  },
};

/** 게시판 표시 이름 — 모르는 키는 키 그대로(위 주석) */
export function boardLabel(sourceKey: string): string {
  return SOURCE_BOARDS[sourceKey]?.label ?? sourceKey;
}

/**
 * 게시판 목록 주소 — 크롤러 `config/sources.json`의 `list_url` 사본(2026-08-29). 운영자 홈이 실패한
 * 게시판을 바로 열어 볼 수 있게 한다. 모르는 키는 `null`(링크 없이 이름만).
 */
export function boardUrl(sourceKey: string): string | null {
  return SOURCE_BOARDS[sourceKey]?.url ?? null;
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
