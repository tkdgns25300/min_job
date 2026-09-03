import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { SITE_URL } from "@/constants/site";
import { getIndexableChurchIds } from "@/lib/queries/churches";
import { getAllJobCards, getFacetCounts } from "@/lib/queries/jobs";
import { FACET_INDEX_MIN } from "@/lib/job-facets";

// 정적 공개 페이지. 인증·운영자 영역은 색인 대상이 아니라 넣지 않는다(robots.ts에서도 차단).
const STATIC_PATHS = ["/", "/jobs", "/about", "/pricing", "/terms", "/privacy"] as const;

/**
 * sitemap.xml — 정적 페이지 + 공고 상세 + 교회 상세.
 *
 * URL 목록을 `lib/queries` seam에서 가져온다 — 그래서 **DB 전환에도 이 파일은 한 줄도 바뀌지 않았다**
 * (2026-08-22 전환 완료. seam을 둔 이유가 이것이다).
 * `getAllJobCards()`는 **모집중만** 준다 — 구글도 마감 공고는 sitemap에서 빼라고 권장하므로
 * 의도된 동작이다(마감 공고 페이지는 계속 열리지만 색인을 재촉하지 않는다).
 * lastModified는 데이터에서 나온 값만 쓴다(`new Date()`는 비결정적이라 캐시와 상충 — CLAUDE 규칙).
 * changeFrequency·priority는 검색엔진이 사실상 무시하므로 넣지 않는다.
 *
 * ⚠️⚠️ **이 라우트는 의도적으로 dynamic(`ƒ`)이다.** 정적으로 두면 캐시 무효화 뒤 **가장 먼저
 *    재생성될 때 500이 나고 빈 sitemap이 나간다**(실측 2026-08-22). 원인은 우리 코드가 아니라
 *    Supabase 클라이언트의 인증 경로(`_useSession` → `Date.now()`)인데, 순수 정적 렌더에서는
 *    비결정적 API가 금지돼 `DYNAMIC_SERVER_USAGE`로 터진다. 라우트 순서에 따라 통과하기도 해서
 *    조용히 숨어 있다가 **콜드 시작한 서버에 검색엔진이 먼저 들어올 때** 재현된다.
 *    → `connection()`으로 dynamic을 선언해 그 금지를 벗는다. **데이터는 그대로 캐시에서 온다**
 *      (`getAllJobCards`·`getIndexableChurchIds`가 `'use cache'`) — 요청마다 하는 일은 XML 조립뿐이고
 *      sitemap 요청은 검색엔진이 드물게 한다. 잃는 것은 이 문서의 정적 서빙뿐이다.
 *
 * ⚠️ 공고가 수만 건이 되면 sitemap 분할(index)이 필요하다 — 규모 문제이지 DB 전환과는 무관.
 * ⚠️ 교회 목록은 **전용 조회**(`getIndexableChurchIds`)를 쓴다 — 검수 중 교회가 섞인 목록을
 *    재사용하면 sitemap이 404 URL을 검색엔진에 먹인다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // 위 ⚠️⚠️ — 정적 렌더 금지를 벗는다(데이터는 계속 캐시에서 온다)
  const [jobs, churchIds, facets] = await Promise.all([
    getAllJobCards(),
    getIndexableChurchIds(),
    getFacetCounts(),
  ]);

  return [
    ...STATIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })),
    // 지역·직분·부서 랜딩 — **공고가 충분한 축만** 넣는다. 3건짜리 페이지의 색인을 재촉하면
    // 얇은 페이지가 쌓여 사이트 전체 평가가 내려간다(그 판정은 페이지의 `noindex`와 같은 기준).
    ...Object.values(facets)
      .flat()
      .filter((facet) => facet.count >= FACET_INDEX_MIN)
      .map((facet) => ({ url: `${SITE_URL}${facet.path}` })),
    ...jobs.map((job) => ({ url: `${SITE_URL}/jobs/${job.id}`, lastModified: job.postedAt })),
    ...churchIds.map((id) => ({ url: `${SITE_URL}/churches/${id}` })),
  ];
}
