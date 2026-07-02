// 도메인 enum — 영어 대문자 key(저장·URL) + 한글 라벨(표시). CLAUDE 컨벤션.
// 허용값은 실제 공고 수집하며 확장한다 (DATA.md). key는 mock/스키마의 단일 출처.

export const DENOMINATIONS = {
  HAPDONG: "예장합동",
  TONGHAP: "예장통합",
  BAEKSEOK: "예장백석",
  GOSIN: "예장고신",
  HAPSIN: "예장합신",
  KIJANG: "기장",
  GAMLI: "감리교",
  SEONGGYUL: "성결교",
  BAPTIST: "침례교",
  SUNBOK: "순복음",
  ETC: "기타",
} as const;
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

// 직분 (순수 직분만 — 전임/파트는 employmentType, 부서는 department로 분리)
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

// 노출 등급 (수익화) — 일반/프리미엄/대표광고
export const FEATURED_TIERS = {
  NONE: "일반",
  PREMIUM: "프리미엄",
  HERO: "대표광고",
} as const;
export type FeaturedTier = keyof typeof FEATURED_TIERS;

// 공고 출처 — 운영자가 수집·등록 / 교회가 직접 등록 (공고 owner nullable 가드레일)
export const JOB_SOURCES = {
  OPERATOR: "운영자 등록",
  CHURCH: "교회 직접 등록",
} as const;
export type JobSource = keyof typeof JOB_SOURCES;

// 교회 채널(홈페이지·SNS) — 노출 순서 = 정의 순서(홈페이지·유튜브 우선). 채널 추가는 여기에만.
export const CHURCH_CHANNELS = {
  HOMEPAGE: "홈페이지",
  YOUTUBE: "유튜브",
  INSTAGRAM: "인스타그램",
  FACEBOOK: "페이스북",
  BAND: "밴드",
} as const;
export type ChurchChannel = keyof typeof CHURCH_CHANNELS;
