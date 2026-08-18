import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants/site";
import { getIndexableChurchIds } from "@/lib/queries/churches";
import { getAllJobCards } from "@/lib/queries/jobs";

// 정적 공개 페이지. 인증·운영자 영역은 색인 대상이 아니라 넣지 않는다(robots.ts에서도 차단).
const STATIC_PATHS = ["/", "/jobs", "/about", "/pricing", "/terms", "/privacy"] as const;

/**
 * sitemap.xml — 정적 페이지 + 공고 상세 + 교회 상세.
 *
 * URL 목록을 `lib/queries` seam에서 가져오므로 **mock→DB 전환 시 이 파일은 그대로**다.
 * `getAllJobCards()`는 **모집중만** 준다 — 구글도 마감 공고는 sitemap에서 빼라고 권장하므로
 * 의도된 동작이다(마감 공고 페이지는 계속 열리지만 색인을 재촉하지 않는다).
 * lastModified는 데이터에서 나온 값만 쓴다(`new Date()`는 비결정적이라 캐시와 상충 — CLAUDE 규칙).
 * changeFrequency·priority는 검색엔진이 사실상 무시하므로 넣지 않는다.
 *
 * ⚠️ 공고가 수만 건이 되면 sitemap 분할(index)이 필요하다 — 규모 문제이지 DB 전환과는 무관.
 * ⚠️ 교회 목록은 **전용 조회**(`getIndexableChurchIds`)를 쓴다. 운영자용 `getChurchOptions`는
 *    검수 중 교회까지 포함하므로, 그걸 재사용하면 sitemap이 404 URL을 검색엔진에 먹인다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jobs, churchIds] = await Promise.all([getAllJobCards(), getIndexableChurchIds()]);

  return [
    ...STATIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...jobs.map((job) => ({ url: `${SITE_URL}/jobs/${job.id}`, lastModified: job.postedAt })),
    ...churchIds.map((id) => ({ url: `${SITE_URL}/churches/${id}` })),
  ];
}
