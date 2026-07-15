// 사업자 정보(전자상거래법 표시사항) — 약관 제15조·푸터 공용 단일 소스.
// ⚠️ 빈 값은 사업자 등록·통신판매업 신고 후 채운다(임의 기재 금지). registrationNumber만 확정.
export const BUSINESS_INFO = {
  name: "", // 상호 (미정)
  ceo: "", // 대표자 (미정)
  registrationNumber: "165-41-01202", // 사업자등록번호
  ecommerceLicense: "", // 통신판매업 신고번호 (신고 후)
  address: "", // 사업장 주소 (미정)
  email: "contact@minjob.kr", // 문의
} as const;

// 표시용 — 미정 값은 플레이스홀더로 노출(정식 운영 전 채움)
export const businessInfoLines = (): string[] => [
  `상호: ${BUSINESS_INFO.name || "[상호]"}`,
  `대표자: ${BUSINESS_INFO.ceo || "[대표자명]"}`,
  `사업자등록번호: ${BUSINESS_INFO.registrationNumber}`,
  `통신판매업 신고번호: ${BUSINESS_INFO.ecommerceLicense || "[신고 후 기재]"}`,
  `주소: ${BUSINESS_INFO.address || "[사업장 주소]"}`,
  `문의: ${BUSINESS_INFO.email}`,
];
