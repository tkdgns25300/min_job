// 서비스 대표 주소 — sitemap·robots·메타데이터의 절대 URL 기준.
// 프리뷰 배포에서도 canonical·sitemap은 **대표 주소**를 가리켜야 하므로 env가 아니라 상수로 둔다
// (env로 두면 프리뷰가 자기 도메인을 대표 주소로 알려 중복 색인을 유발한다).
export const SITE_URL = "https://www.minjob.co.kr";
