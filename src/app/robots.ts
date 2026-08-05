import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants/site";

/**
 * robots.txt — 공개 페이지만 크롤링 허용.
 *
 * 인증·운영자 영역은 각 layout에서 이미 noindex지만, 크롤링 자체를 막아 크롤링 예산을 아낀다
 * (색인 차단과 크롤링 차단은 별개다).
 *
 * ⚠️ 검색엔진에 "초대"하는 행위는 이 파일이 아니라 **Search Console 사이트맵 등록**이다.
 *    지금 데이터는 mock이므로 등록은 실 공고가 들어온 뒤에 한다(ROADMAP 1-5).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 접두사 일치라 하위 경로까지 함께 막힌다(/mypage, /mypage/church …).
      // /jobs 자체는 공개이므로 등록·수정만 개별 지정한다(둘 다 (authed) — layout에서 noindex).
      disallow: ["/mypage", "/admin", "/login", "/auth", "/api", "/jobs/new", "/jobs/*/edit"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
