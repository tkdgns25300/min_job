import type { Metadata } from "next";

// 서비스 대표 도메인·주소 — sitemap·robots·메타데이터의 절대 URL 기준.
// 프리뷰 배포에서도 canonical·sitemap은 **대표 주소**를 가리켜야 하므로 env가 아니라 상수로 둔다
// (env로 두면 프리뷰가 자기 도메인을 대표 주소로 알려 중복 색인을 유발한다).
export const SITE_DOMAIN = "minjob.co.kr";
// ⚠️ 후행 슬래시 금지 — sitemap이 `${SITE_URL}${path}`로 조립하므로 `//`가 된다.
export const SITE_URL = `https://www.${SITE_DOMAIN}`;

// 네이버 지도 검색 — 교회 위치 링크(임베드는 Phase 2, API 키 필요). 조립은 lib/format의 naverMapUrl
export const NAVER_MAP_SEARCH_URL = "https://map.naver.com/p/search/";

// OG 이미지 버전 — 브랜드 카드를 바꾸면 이 숫자를 올린다.
// 카카오톡·페이스북은 URL 단위로 미리보기를 캐시해서, URL이 같으면 새 이미지를 영구히 안 가져간다.
const OG_IMAGE_VERSION = 1;

/**
 * OG 이미지가 쓰는 브랜드 색 — `globals.css`의 토큰과 **같은 값**이다.
 * satori(`ImageResponse`)는 CSS 변수를 못 읽어 리터럴이 필요하고, 그림을 그리는 파일이 둘이라
 * (사이트 카드 · 공고별 카드) 여기 한 번만 적는다. 브랜드 색을 바꾸면 `globals.css`와 여기 둘을 고친다.
 */
export const OG_COLORS = { brand900: "#15332a", gold: "#d3ad63" } as const;

/**
 * OG 공통값.
 *
 * ⚠️ Next는 `openGraph`를 **통째로 교체**한다(필드 병합 아님). 그래서 openGraph를 재정의하는
 *    페이지는 root layout의 `siteName`·`locale`은 물론 **파일 기반 OG 이미지**
 *    (`app/opengraph-image.tsx`)까지 잃는다 → 이미지도 여기서 명시해야 전 페이지에 붙는다.
 * ⚠️ **공고 상세는 이 객체를 펴지 않는다**(2026-09-05) — 자기 세그먼트의 `opengraph-image.tsx`가 넣어 줄
 *    공고별 카드를 여기의 로고 `images`가 덮어 막기 때문이다. 그 페이지는 `siteName`·`locale`만 골라 쓴다.
 *    교회 상세는 전용 이미지가 없어 계속 통째로 펴서 로고 카드를 쓴다.
 * ⚠️ width·height·alt를 직접 주는 이유: 파일 규약이 자동으로 넣어주던 값들이 이 우회로 사라진다.
 *    카카오톡·페이스북은 크기 정보가 없으면 첫 스크랩에서 썸네일을 잘못 잡거나 빠뜨린다.
 * `satisfies`로 검증한다 — 그냥 객체로 두면 `images` 오타도 컴파일을 통과해 태그가 조용히 사라진다.
 */
export const SITE_OPEN_GRAPH = {
  siteName: "민잡",
  locale: "ko_KR",
  images: [
    {
      url: `/opengraph-image?v=${OG_IMAGE_VERSION}`,
      width: 1200,
      height: 630,
      type: "image/png",
      alt: "MinJob — 사역자 청빙 공고",
    },
  ],
} satisfies NonNullable<Metadata["openGraph"]>;
