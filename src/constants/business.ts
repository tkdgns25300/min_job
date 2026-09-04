// 약관·개인정보처리방침 **시행일은 문서마다 따로다** — 한 상수로 묶으면 한쪽만 개정했을 때
// 다른 쪽 시행일까지 움직여 **바뀌지 않은 문서가 새로 시행된 것처럼** 보인다(2026-08-25 분리).
// **2026-09-04 최초 시행**(운영자 결정) — 그전 화면(07-20·08-25)은 정식 시행 전 초안이라 이력에 두지 않는다.
export const TERMS_EFFECTIVE_DATE = "2026-09-04";

/**
 * 개인정보처리방침 시행일. **2026-09-04 최초 시행** — 개인정보보호위원회 작성지침(2025.4.) 순서로
 * 전면 재작성한 본문이 첫 시행분이다(그전 07-20·08-25 화면은 초안).
 *
 * ⚠️ **이 값이 곧 동의 기록의 버전이다**(`users.verification_consent_version`). 방침 본문을 고치면
 *    이 날짜도 함께 올려야 한다 — 안 올리면 새 문구에 대한 동의가 **옛 텍스트로 기록된다.**
 * ⚠️ 개정 시점에 이미 접수된 신청이 있으면 이 값으로 **재동의 대상을 골라낸다**(DATA §3).
 */
export const PRIVACY_EFFECTIVE_DATE = "2026-09-04";

// 사업자 정보(전자상거래법 표시사항) — 약관 제15조·푸터 공용 단일 소스.
// ⚠️ 통신판매업: 현재 면제 대상(신규·직전연도 거래 50건 미만)이라 빈 값 = 표기 생략(정당).
// 연 통신판매 50건 초과 시 신고 후 번호 기재.
export const BUSINESS_INFO = {
  name: "훈테크", // 상호
  ceo: "이상훈", // 대표자
  registrationNumber: "165-41-01202", // 사업자등록번호
  ecommerceLicense: "", // 통신판매업 신고번호 (면제 대상 — 직전연도 거래 50건 미만; 초과 시 신고)
  address: "경상북도 안동시 감나무5길 15", // 사업장 주소
  phone: "010-6607-3927", // 연락처 (KCP 결제 심사 '유선번호' 필수 항목)
  email: "tkdgns25300@naver.com", // 문의
  hostingProvider: "Vercel Inc.", // 호스팅서비스 제공자 상호 — 전자상거래법 제10조 시행령 표시사항(사이버몰 운영자 의무)
} as const;

// 문의·요청 메일 링크 — 제목은 반드시 인코딩한다(사이트마다 직접 조립하면 공백·`·`가 빠진다).
export const contactMailto = (subject?: string): string =>
  subject
    ? `mailto:${BUSINESS_INFO.email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${BUSINESS_INFO.email}`;

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
  `호스팅서비스 제공자: ${BUSINESS_INFO.hostingProvider}`,
];
