// 약관·개인정보처리방침 시행일 — 두 문서 상단·부칙 공용 단일 소스.
export const LEGAL_EFFECTIVE_DATE = "2026-07-20";

// 사업자 정보(전자상거래법 표시사항) — 약관 제15조·푸터 공용 단일 소스.
// ⚠️ 통신판매업 신고번호는 신고 후 채운다(미신고 시 빈 값 = 표기에서 생략).
export const BUSINESS_INFO = {
  name: "훈테크", // 상호
  ceo: "이상훈", // 대표자
  registrationNumber: "165-41-01202", // 사업자등록번호
  ecommerceLicense: "", // 통신판매업 신고번호 (미신고 — 신고 후 기재)
  address: "경상북도 안동시 감나무5길 15", // 사업장 주소
  phone: "010-6607-3927", // 연락처 (KCP 결제 심사 '유선번호' 필수 항목)
  email: "tkdgns25300@naver.com", // 문의
} as const;

// 표시용 라인 — 통신판매업 미신고 시 해당 줄 생략.
export const businessInfoLines = (): string[] => [
  `상호: ${BUSINESS_INFO.name}`,
  `대표자: ${BUSINESS_INFO.ceo}`,
  `사업자등록번호: ${BUSINESS_INFO.registrationNumber}`,
  ...(BUSINESS_INFO.ecommerceLicense
    ? [`통신판매업 신고번호: ${BUSINESS_INFO.ecommerceLicense}`]
    : []),
  `주소: ${BUSINESS_INFO.address}`,
  `전화: ${BUSINESS_INFO.phone}`,
  `이메일: ${BUSINESS_INFO.email}`,
];
