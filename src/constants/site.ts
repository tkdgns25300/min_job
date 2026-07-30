// 서비스 대표 주소 — sitemap·robots·메타데이터의 절대 URL 기준.
// 프리뷰 배포에서도 canonical·sitemap은 **대표 주소**를 가리켜야 하므로 env가 아니라 상수로 둔다
// (env로 두면 프리뷰가 자기 도메인을 대표 주소로 알려 중복 색인을 유발한다).
export const SITE_URL = "https://www.minjob.co.kr";

// OG 공통값 — ⚠️ Next는 `openGraph` 객체를 **통째로 교체**한다(필드 병합 아님).
// 그래서 openGraph를 재정의하는 페이지(공고·교회 상세)는 root layout의 siteName·locale을 잃는다.
// 양쪽이 이 상수를 펼쳐 쓰면 한 곳에서 관리된다.
export const SITE_OPEN_GRAPH = { siteName: "민잡", locale: "ko_KR" } as const;
