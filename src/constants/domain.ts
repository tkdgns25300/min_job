// 도메인 enum — 영어 대문자 key(저장·URL) + 한글 라벨(표시). CLAUDE 컨벤션.
// 허용값은 실제 공고 수집하며 확장한다 (DATA.md). key는 **DB CHECK와 화면**이 함께 쓰는 단일 출처.

export const DENOMINATIONS = {
  HAPDONG: "예장합동",
  TONGHAP: "예장통합",
  BAEKSEOK: "예장백석",
  GOSIN: "예장고신",
  HAPSIN: "예장합신",
  GAMLI: "감리교",
  SEONGGYUL: "성결교",
  BAPTIST: "침례교",
  SUNBOK: "순복음",
  ETC: "기타",
} as const;

/**
 * 교회명 앞에 붙는 교단 표기 — 같은 교회가 공고마다 넣었다 뺐다 해서 이름이 갈린다.
 * 교회 동일성 판정에서 벗겨낸다(`lib/job-church.ts`의 `normalizeChurchName`).
 *
 * ⚠️ **교회 이름의 일부가 될 수 없는 표기만** 넣는다. `순복음`·`감리교`·`침례교`·`성결교`는
 *    실제 교회명 앞머리로 쓰이고("순복음중앙교회"), **`기장`은 부산 기장군이라는 지명**이다
 *    ("기장제일교회" → "제일교회"가 되어 그 지역 다른 제일교회와 **합쳐진다**).
 *    갈라지는 오차(한 교회가 둘로)보다 합쳐지는 오차가 나쁘다 — 애매하면 넣지 않는다.
 */
export const CHURCH_NAME_DENOMINATION_PREFIXES = [
  "대한예수교장로회",
  "한국기독교장로회", // 축약 "기장"은 지명과 겹쳐 제외 — 정식 명칭만 지운다
  "기독교대한감리회",
  "기독교한국침례회",
  "기독교대한성결교회",
  "기독교대한하나님의성회",
  "예수교대한성결교회",
  "대한성공회",
  // "예장합동"처럼 갈래까지 붙은 축약형 — 라벨 맵에서 끌어와 교단이 늘어도 자동으로 따라온다.
  // 갈래 없는 "예장"은 따로 두어 둘 다 잡는다("예장 ○○교회" 형태).
  ...Object.values(DENOMINATIONS).filter((label) => label.startsWith("예장")),
  "예장",
];
export type Denomination = keyof typeof DENOMINATIONS;

/**
 * `city` 칸 안내 — **예시만 준다.** 규칙을 설명하려 들면("지역 다음 단계까지요") *단계*가
 * 추상적이라 읽고 나서도 한 번 더 생각해야 한다(실사용 2026-08-26).
 *
 * ⚠️ **받는 단위는 기초자치단체 하나다** — `강남구`(자치구)·`용인시`(시)·`안동시`가 같은 레벨이고,
 *    `수지구`는 용인시 안의 **일반구**(자치단체 아님)라 한 단계 아래다. 그래서 `용인시 수지구`처럼
 *    두 단어를 받지 않는다: 구는 **상세 주소**로 간다(`수지구 동천동 950-6`). 한때 예시에
 *    `용인시 수지구`를 넣었다가 되돌렸다 — 합성어를 한 단위처럼 가르쳐 오히려 헷갈렸다.
 *    (법정동코드 기준 기초자치단체 229개 · 일반구까지 세면 255개)
 * ⚠️ 크롤 데이터에는 `성남시 분당구`처럼 두 단어가 섞여 있다. 그건 크롤러가 자유 텍스트로 넣는
 *    값이고 표시·검색에만 쓰므로 굳이 맞추지 않는다 — 우리 폼이 만드는 값만 한 단위로 유지한다.
 * 폼 3곳이 각자 다른 예시(`강남구`·`수원`·`성남`)를 주고 있어 접미사 유무마저 갈렸다 —
 * 예시를 한 곳에서 준다.
 */
export const CITY_HINT = "예) 강남구, 안동시, 용인시";
export const CITY_PLACEHOLDER = "강남구";

/**
 * 상세 주소 칸 — **`region`·`city` 다음 조각만** 받는다(`서울 강남구`를 다시 적지 않는다).
 * ⚠️ 크롤 실데이터도 이 모양이다(`청수12로 29`·`신정동 311-11`). 그래서 표시·지도 링크는
 *    `churchPlaceLine`이 지역·시와 **이어 붙여** 만든다 — 이 칸 하나만 쓰면 "청수12로 29"를
 *    검색하게 된다.
 */
export const ADDRESS_PLACEHOLDER = "테헤란로 1";

export const REGIONS = {
  SEOUL: "서울",
  GYEONGGI: "경기",
  INCHEON: "인천",
  GANGWON: "강원",
  CHUNGBUK: "충북",
  CHUNGNAM: "충남",
  DAEJEON: "대전",
  SEJONG: "세종",
  GYEONGBUK: "경북",
  GYEONGNAM: "경남",
  DAEGU: "대구",
  ULSAN: "울산",
  BUSAN: "부산",
  JEONBUK: "전북",
  JEONNAM: "전남",
  GWANGJU: "광주",
  JEJU: "제주",
  OVERSEAS: "해외",
} as const;
export type Region = keyof typeof REGIONS;

// 채용 구분(최상위 축) — 사역직(목사·전도사 등) / 일반직(방송·행정·시설 등). 목록 기본뷰=사역직.
export const JOB_KINDS = {
  MINISTRY: "사역직",
  GENERAL: "일반직",
} as const;
export type JobKind = keyof typeof JOB_KINDS;

// 직분 (순수 직분만 — 전임/파트는 employmentType, 부서는 department로 분리). 사역직 전용.
export const POSITIONS = {
  SENIOR_PASTOR: "담임목사",
  ASSOCIATE_PASTOR: "부목사",
  EVANGELIST: "전도사",
  LICENSED_MINISTER: "강도사",
  ETC: "기타",
} as const;
export type Position = keyof typeof POSITIONS;

export const DEPARTMENTS = {
  INFANT: "영유아부",
  CHILDREN: "유초등부",
  YOUTH: "중고등부",
  YOUNG_ADULT: "청년부",
  DISTRICT: "장년·교구",
  WORSHIP: "찬양·예배",
  ADMIN: "행정",
  ETC: "기타",
} as const;
export type Department = keyof typeof DEPARTMENTS;

export const EMPLOYMENT_TYPES = {
  FULL_TIME: "전임",
  SEMI_FULL_TIME: "준전임",
  PART_TIME: "파트",
} as const;
export type EmploymentType = keyof typeof EMPLOYMENT_TYPES;

/**
 * 자격/경력 요건 — 공고가 요구하는 자격 수준 (필터·표시). 성별·결혼여부는 채용차별 금지라 두지 않는다.
 *
 * ⚠️ **이 다섯은 우리가 만든 축이지 교단 게시판의 언어가 아니다.** 실공고는 경력을 등급이 아니라
 *    **연수로** 쓴다("목사 안수 후 목회경력 5년 이상인 자"). 그래서 크롤러가 뽑은 값은 셋뿐이고
 *    (신학생 497 · 목사안수 97 · 경력 22) `ANY`·`ENTRY`는 **0건**이다(실측 877건 · 2026-08-27).
 *    교회가 직접 고를 때만 쓰이는 값이라, 라벨은 **교회가 쓰는 말**이어야 한다.
 * ⚠️ `ENTRY`가 한때 "신규 가능"이었다 — 옆의 `ANY`("무관")와 뜻이 겹쳐 교회가 무엇을 골라야
 *    할지 알 수 없었다(둘 다 0건인 것이 우연이 아닐 수 있다). **"초임"은 교회가 실제로 쓰는 말**
 *    이고("초임 전도사"·"초임지"), 그렇게 두면 `무관`(조건 없음)과 뜻이 갈린다.
 *    "신입"은 기업 채용 어휘라 교역자 청빙에 쓰지 않는다.
 * ⚠️ **`ANY`(무관)와 `null`은 다른 값이다.** 크롤러가 *"`무관`이라고 **적혀 있으면** ANY /
 *    자격 이야기가 **없으면** null"* 로 갈라서 보낸다(min_job_agent `extraction.py`) — 사택에서
 *    `false`(명시적 미제공)와 `null`(정보 없음)을 가르는 것과 **같은 구분**이다.
 *    ⛔ 한때 `ANY`를 지웠다가 되돌렸다(2026-08-27) — DATA가 `NULL`을 "무관"이라 적어 둔 것을
 *       보고 중복이라 판단했는데, **틀린 쪽은 그 DATA 문장이었다**. 지우면 "무관이라고 밝힌 공고"와
 *       "아무 말 없는 공고"가 한 덩어리가 된다 — 원문이 한 말을 우리가 지우는 셈이다.
 *    ⚠️ `ANY`가 실측 0건인 것은 값이 죽어서가 아니다 — 크롤러가 겹칠 때
 *       `ORDAINED > SEMINARIAN > EXPERIENCED > ENTRY > ANY` 순으로 고르는데 `ANY`가 **꼴찌**라
 *       "경력 무관"은 `EXPERIENCED`로 간다. 이기기 어려운 값이지 잘못된 값이 아니다.
 */
export const QUALIFICATIONS = {
  ANY: "무관",
  ENTRY: "초임 가능",
  EXPERIENCED: "경력",
  ORDAINED: "목사안수",
  SEMINARIAN: "신학생",
} as const;
export type Qualification = keyof typeof QUALIFICATIONS;

// 공고 상태 — 두 값뿐이다. ⚠️ `PENDING`(검수중)은 **뺐다**(2026-08-21): 공고 전수 검수를
// 하지 않는다. 공고를 올릴 수 있는 사람은 교회 인증을 통과한 관리자뿐이고, 크롤 공고는
// `review_data`에서 이미 검수를 거치므로 두 입력 경로 모두 관문을 이미 지난다.
// (이 결정은 세 번 뒤집혔다 — 근거는 마이그레이션 20260821051500 주석에 있다.)
export const JOB_STATUSES = {
  OPEN: "모집중",
  CLOSED: "마감",
} as const;
export type JobStatus = keyof typeof JOB_STATUSES;

// 노출 등급 — `jobs.featured_tier`의 값(현재 유효 노출의 캐시 · DATA §7). NONE = 노출 없음.
// 상품 자체(자리·정원·가격)는 아래 `EXPOSURE_PRODUCTS`가 정의하고, 여기는 라벨만 갖는다.
// ⚠️ 등급명은 **교회가 사는 상품 이름**이다 — 구직자 화면에는 나오지 않는다(카드·로우는 "광고" 한 단어).
export const FEATURED_TIERS = {
  NONE: "일반",
  SPECIAL: "스페셜",
  PLUS: "플러스",
  BASIC: "기본",
} as const satisfies Record<ExposureProduct | "NONE", string>;
export type FeaturedTier = keyof typeof FEATURED_TIERS;

// 상시모집(마감일 없음) 공고의 공개 유효 기간(일). 이 기간이 지나면 공개 목록에서 내린다.
// 마감일 없이 방치된 공고가 영구히 "모집중"으로 남는 것을 막는다 (DATA.md §6-1).
// 짧게 잡아 살아있는 공고를 숨기는 게 더 나쁜 오류라 넉넉히 잡았다.
// ⚠️ **이 숫자를 바꾸면 크롤러에 통보한다** — 그쪽이 사본을 들고 중복 판정에 쓴다
//    (근거·증상은 `lib/job-visibility.ts`의 `isPubliclyOpen` 주석).
export const ALWAYS_OPEN_MAX_DAYS = 90;

// "이번 주 새 공고" 집계 창(일). 홈 스탯과 운영자 홈이 같은 값을 써야 숫자가 갈리지 않는다.
export const RECENT_WINDOW_DAYS = 7;

// 노출 상품(결제) — 사다리 3등급(확정 2026-09-02 · SPEC 수익화 절 · DATA §7). **가격 단일 소스**:
// 요금 페이지·결제 화면·서버 금액 검증이 전부 여기서 읽는다. VAT 포함가(원).
//
// 자리는 셋이다 — 홈 추천 카드 3칸 · 공고 목록 1페이지 상단 로우(최대 5줄) · 공고 상세 "비슷한 공고" 첫 칸.
// 등급은 **닿는 범위**로 갈린다: 스페셜 = 셋 다 · 플러스 = 목록 + 연관 · 기본 = 연관만.
// 정원(`weeklyCapacity`)은 **주 단위**다 — 홈 3칸·목록 5줄이 자리 수라 그보다 많이 팔 수 없다.
// 기본은 정원이 없다 — 연관 첫 칸은 **같은 지역** 광고만 서서 지역별로 자연히 나뉜다.
export const EXPOSURE_SLOTS = {
  home: "홈 추천 카드",
  list: "목록 상단 로우",
  related: "비슷한 공고 첫 칸",
} as const;
export type ExposureSlot = keyof typeof EXPOSURE_SLOTS;

export const EXPOSURE_WEEKS = [1, 2, 4] as const;
export type ExposureWeeks = (typeof EXPOSURE_WEEKS)[number];

interface ExposureProductDef {
  label: string;
  slots: Record<ExposureSlot, boolean>;
  /** 한 주에 팔 수 있는 건수. null = 정원 없음 */
  weeklyCapacity: number | null;
  /** 주수별 가격(원, VAT 포함). 2주·4주는 묶음가라 주 단가 × 주수가 아니다 — 계산하지 않고 표로 둔다 */
  prices: Record<ExposureWeeks, number>;
  desc: string;
}

// ⚠️ 키 순서 = 사다리 위부터(스페셜 → 플러스 → 기본). `tiersForSlot`이 이 순서를 그대로 쓴다.
export const EXPOSURE_PRODUCTS = {
  SPECIAL: {
    label: "스페셜",
    slots: { home: true, list: true, related: true },
    weeklyCapacity: 3,
    prices: { 1: 99_000, 2: 189_000, 4: 299_000 },
    desc: "홈 추천 카드 + 목록 상단 + 비슷한 공고 첫 칸",
  },
  PLUS: {
    label: "플러스",
    slots: { home: false, list: true, related: true },
    weeklyCapacity: 2,
    prices: { 1: 49_000, 2: 94_000, 4: 149_000 },
    desc: "목록 상단 + 비슷한 공고 첫 칸",
  },
  BASIC: {
    label: "기본",
    slots: { home: false, list: false, related: true },
    weeklyCapacity: null,
    prices: { 1: 29_000, 2: 55_000, 4: 89_000 },
    desc: "같은 지역 공고 상세의 비슷한 공고 첫 칸",
  },
} as const satisfies Record<string, ExposureProductDef>;
export type ExposureProduct = keyof typeof EXPOSURE_PRODUCTS;

/** 이 자리에 설 수 있는 등급 — 사다리 위부터. 목록 상단 로우가 스페셜 → 플러스로 서는 근거 */
export function tiersForSlot(slot: ExposureSlot): ExposureProduct[] {
  return (Object.keys(EXPOSURE_PRODUCTS) as ExposureProduct[]).filter(
    (tier) => EXPOSURE_PRODUCTS[tier].slots[slot],
  );
}

export function isExposureProduct(value: unknown): value is ExposureProduct {
  return typeof value === "string" && value in EXPOSURE_PRODUCTS;
}

export function isExposureWeeks(value: unknown): value is ExposureWeeks {
  return (EXPOSURE_WEEKS as readonly unknown[]).includes(value);
}

/** 노출 금액 — client·server가 같은 표를 읽는다(서버가 재계산해 위변조를 막는다) */
export function exposurePrice(tier: ExposureProduct, weeks: ExposureWeeks): number {
  return EXPOSURE_PRODUCTS[tier].prices[weeks];
}

// 자리 크기 — 홈 추천 카드 칸 수 · 공고 상세 "비슷한 공고" 장 수(첫 칸이 광고 자리).
// 목록 상단 로우는 상수가 없다 — 등급별 주 정원(스페셜 3 + 플러스 2 = 최대 5줄)이 그대로 상한이다(`splitListAds`).
export const HOME_AD_SLOTS = 3;
export const SIMILAR_JOBS_COUNT = 6;

// 노출 구매 원장(`job_promotions.status`)의 상태 — 결제 이력 한 줄이 지금 어떤 상태인가.
// 원장은 append-only라 행을 지우지 않고 이 값을 바꾼다(DATA.md §3 `job_promotions`). **정원 판정은 PAID만 센다.**
// 환불 정책(확정 2026-09-03 · 약관 제10조와 한 쌍):
//   CANCELLED — **게재 시작 전** 취소. 전액 환불. 주 단위 상품이라 일할 계산은 없다.
//   REFUNDED  — 게재 시작 뒤 운영자가 예외로 환불한 것. 기본은 환불 없음(시작 뒤에는 남은 기간을 소진한다).
export const PROMOTION_STATUSES = {
  PAID: "결제완료",
  REFUNDED: "환불",
  CANCELLED: "취소",
} as const;
export type PromotionStatus = keyof typeof PROMOTION_STATUSES;

// 공고 출처 — 운영자가 수집·등록 / 교회가 직접 등록 (공고 owner nullable 가드레일)
export const JOB_SOURCES = {
  OPERATOR: "운영자 등록",
  CHURCH: "교회 직접 등록",
} as const;
export type JobSource = keyof typeof JOB_SOURCES;

// **사람의** 인증 신청 상태(`users.church_verification_status`) — 증빙 서류 제출 → 운영자 승인.
// null(미신청) = 일반 사역자. 반려되면 사유와 함께 재신청한다.
export const CHURCH_VERIFICATION_STATUSES = {
  PENDING: "검수중",
  APPROVED: "인증 완료",
  REJECTED: "반려",
} as const;
export type ChurchVerificationStatus = keyof typeof CHURCH_VERIFICATION_STATUSES;

// **교회 행의** 검증 상태(`churches.verification_status`) — 값이 둘뿐이다(마이그레이션 20260825081000).
// ⚠️ 위 맵과 **키 집합이 다르다**: 거부는 사람 쪽에만 있다. 교회를 내리는 것은 `PENDING`으로
//    되돌리기이고(공개 조회가 `APPROVED`만 본다 · DATA §9), 그러면 그 순간 내려간다.
//    한때 여기에도 `REJECTED`가 있었는데 같은 이름이 두 테이블에서 다른 뜻이라 읽는 사람이 섞었다.
// 라벨이 "검수중"이 아니라 "미검증"인 이유: 이 값은 사람의 작업 상태가 아니라 **교회의 상태**다.
export const CHURCH_STATUSES = {
  PENDING: "미검증",
  APPROVED: "인증 완료",
} as const;
export type ChurchStatus = keyof typeof CHURCH_STATUSES;

// 사례비·급여 기간 — 금액이 월 기준인지 연 기준인지. 사역직은 월이 압도적이라 기본이 MONTH고,
// 일반직·담임목사 공고에서 연 표기가 나온다. **표시는 이 라벨 그대로**(원문 단위 유지),
// **필터는 월로 환산해 비교**한다(filter-jobs.ts) — 환산값을 화면에 쓰지 않는 이유는
// 연봉에 상여가 섞이면 ÷12가 실제 월 지급액이 아니어서, 우리가 없는 숫자를 만들게 되기 때문이다.
export const PAY_PERIODS = {
  MONTH: "월",
  YEAR: "연",
} as const;
export type PayPeriod = keyof typeof PAY_PERIODS;

// 공고 등록 폼 프리셋 — 인터뷰 반영: 사례비는 "거의 내규에 따름"(비정형 경로를 숫자와 동급으로)
export const PAY_NOTE_PRESETS = ["교회 내규에 따름", "면접 후 협의"] as const;

// 자격 요건 프리셋 — 청빙 공고 조사(교단 게시판 실공고) 반영. 성별·연령·결혼은 가드레일상 제외.
export const QUALIFICATION_PRESETS = [
  "본 교단 소속",
  "신학대학원(M.Div) 졸업(예정)",
  "목사 안수 (예정 포함)",
  "해당 부서 사역 경험",
  "운전면허 소지",
  "교단법·사회법에 무흠한 자",
] as const;

/**
 * 우대 사항 프리셋 — 자격 요건과 **다른 목록**이다. 자격에 섞으면 지원자가 "못 낸다"로 읽는다.
 * ⚠️ 성별·연령·결혼 여부는 두지 않는다(가드레일 — 자격 프리셋과 같은 이유).
 * ⚠️ **`QUALIFICATION_PRESETS`와 겹치는 항목을 두지 않는다.** 두 목록은 서로를 모르는 별개
 *    `CheckList`라 같은 항목이 양쪽에 담기고, 그러면 공개 상세에서 한 줄이 "자격 요건"과
 *    "우대 사항"에 동시에 떠 필수인지 아닌지가 서로 모순된다.
 *    (그래서 `해당 부서 사역 경험`을 뺐다 — 자격 쪽에 남긴다.)
 */
export const PREFERRED_PRESETS = [
  "찬양·악기 반주 가능",
  "영상·미디어 편집 가능",
  "인근 거주 또는 이주 가능",
  "차량 소지",
] as const;

// 제출 서류 프리셋 — 청빙 공고 조사 반영(담임용 목회계획서·설교영상·추천서 포함)
export const REQUIRED_DOC_PRESETS = [
  "이력서",
  "자기소개서",
  "가족관계증명서",
  "목회계획서·사역계획서",
  "설교 영상·음성",
  "추천서",
  "졸업·성적 증명서",
] as const;

/**
 * 사택 제공 여부 — 등록 폼에서 **필수**다(`job-draft`의 `draftErrors`).
 * ⚠️ 한때 주석이 *"사례비보다 명시율 높음"* 이라고 했는데 **반대다**(실측 877건: 사례비 91% ·
 *    사택 40%). 사택은 **있으면 자랑하고 없으면 침묵**하는 값이라 "미제공"이 7건뿐이고,
 *    전임은 71%가 밝히는데 파트는 6%다. 그 침묵을 물려받지 않으려고 필수로 두었다.
 * ⚠️ `NEGOTIABLE`이 있어 필수로 둘 수 있다 — 모르는 교회에게 거짓을 강요하지 않는다.
 *    저장은 두 컬럼으로 갈린다(`housing_provided` + `housing_note` · DATA §3).
 */
export const HOUSING_OPTIONS = {
  PROVIDED: "제공",
  NONE: "미제공",
  NEGOTIABLE: "협의",
} as const;
export type HousingOption = keyof typeof HOUSING_OPTIONS;

// 지원(접수) 방법 — 사이트 내 지원 없음(가드레일). 교회 채널로 안내만.
// 지원 접수 방법 — `jobs.contact_email`·`contact_link`·`contact_tel`·`contact_post`와 1:1(닫힌 4키).
// **정의 순서 = 표시 순서**(CHURCH_CHANNELS와 같은 규칙). 앞의 셋은 서류를 내는 경로이고
// 전화는 대개 문의용이라 마지막이다 — 공고 상세와 등록 폼이 이 순서를 함께 쓴다.
export const APPLY_METHODS = {
  LINK: "홈페이지·양식 링크",
  EMAIL: "이메일",
  POST: "우편·방문",
  TEL: "전화",
} as const;
export type ApplyMethod = keyof typeof APPLY_METHODS;

// 교회 채널(홈페이지·SNS) — 노출 순서 = 정의 순서(홈페이지·유튜브 우선). 채널 추가는 여기에만.
export const CHURCH_CHANNELS = {
  HOMEPAGE: "홈페이지",
  YOUTUBE: "유튜브",
  INSTAGRAM: "인스타그램",
  FACEBOOK: "페이스북",
  BAND: "밴드",
  ETC: "기타",
} as const;
export type ChurchChannel = keyof typeof CHURCH_CHANNELS;
