// 도메인 enum — 영어 대문자 key(저장·URL) + 한글 라벨(표시). CLAUDE 컨벤션.
// 허용값은 실제 공고 수집하며 확장한다 (DATA.md). key는 mock/스키마의 단일 출처.

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

// 자격/경력 요건 — 공고가 요구하는 자격 수준 (필터·표시). 성별·결혼여부는 채용차별 금지라 두지 않는다.
export const QUALIFICATIONS = {
  ANY: "무관",
  ENTRY: "신규 가능",
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

// 노출 등급 (수익화) — 일반/프리미엄/대표광고
export const FEATURED_TIERS = {
  NONE: "일반",
  PREMIUM: "프리미엄",
  HERO: "대표광고",
} as const;
export type FeaturedTier = keyof typeof FEATURED_TIERS;

// 상시모집(마감일 없음) 공고의 공개 유효 기간(일). 이 기간이 지나면 공개 목록에서 내린다.
// 마감일 없이 방치된 공고가 영구히 "모집중"으로 남는 것을 막는다 (DATA.md §6-1).
// 짧게 잡아 살아있는 공고를 숨기는 게 더 나쁜 오류라 넉넉히 잡았다.
// ⚠️ **이 숫자를 바꾸면 크롤러에 통보한다** — 그쪽이 사본을 들고 중복 판정에 쓴다
//    (근거·증상은 `lib/job-visibility.ts`의 `isPubliclyOpen` 주석).
export const ALWAYS_OPEN_MAX_DAYS = 90;

// "이번 주 새 공고" 집계 창(일). 홈 스탯과 운영자 홈이 같은 값을 써야 숫자가 갈리지 않는다.
export const RECENT_WINDOW_DAYS = 7;

// 노출 상품(결제) — 가격 단일 소스(promote 결제 페이지 + 서버 금액 검증 공용). VAT 포함가(원).
// 가격 확정은 SNAPSHOT §9(BM). NONE은 유료 상품 아님.
export const EXPOSURE_PRODUCTS = {
  PREMIUM: {
    label: "프리미엄",
    weekly: 70000,
    bundle4: 240000,
    desc: "목록·검색 결과 상단 고정 + “광고” 표시",
  },
  HERO: {
    label: "대표광고",
    weekly: 150000,
    bundle4: 500000,
    desc: "홈 배너 + 목록 최상단(구좌 한정) · 프리미엄 노출 포함",
  },
} as const;
export type ExposureProduct = keyof typeof EXPOSURE_PRODUCTS;
export const EXPOSURE_WEEKS = [1, 2, 4] as const;

// 노출 구매 원장(`job_promotions.status`)의 상태 — 결제 이력 한 줄이 지금 어떤 상태인가.
// 원장은 append-only라 행을 지우지 않고 이 값을 바꾼다(DATA.md §3 `job_promotions`).
// ⚠️ REFUNDED와 CANCELLED의 **경계는 아직 정하지 않았다** — 스키마 확정(2026-08-05) 때 세 값만
//    정해졌다. 라벨은 어느 해석에도 참인 직역으로 두었다. 주문 저장(ROADMAP Phase 1)에서
//    "적용 전 전액취소 vs 적용 후 일할환불"인지 "승인취소 vs 매입후환불"인지 정하고 여기 적는다
//    — HERO 구좌 판정이 취소된 행을 세는지에 답이 달라진다.
export const PROMOTION_STATUSES = {
  PAID: "결제완료",
  REFUNDED: "환불",
  CANCELLED: "취소",
} as const;
export type PromotionStatus = keyof typeof PROMOTION_STATUSES;

// 노출 금액 계산 — 4주는 묶음가, 그 외는 주 단가 × 주수. (client·server 동일 계산 → 위변조 검증)
export function exposurePrice(tier: ExposureProduct, weeks: number): number {
  const p = EXPOSURE_PRODUCTS[tier];
  return weeks === 4 ? p.bundle4 : p.weekly * weeks;
}

// 공고 출처 — 운영자가 수집·등록 / 교회가 직접 등록 (공고 owner nullable 가드레일)
export const JOB_SOURCES = {
  OPERATOR: "운영자 등록",
  CHURCH: "교회 직접 등록",
} as const;
export type JobSource = keyof typeof JOB_SOURCES;

// 교회 인증 상태 — 증빙 서류(고유번호증/사업자등록증) 제출 → 운영자 승인.
// null(미신청) = 일반 사역자, APPROVED만 공고 게재 가능. (단일 계정 모델, DATA §2·§3)
export const CHURCH_VERIFICATION_STATUSES = {
  PENDING: "검수중",
  APPROVED: "인증 완료",
  REJECTED: "반려",
} as const;
export type ChurchVerificationStatus = keyof typeof CHURCH_VERIFICATION_STATUSES;

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

// 사택 제공 여부 — 청빙 공고에서 사례비보다 명시율 높음
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
