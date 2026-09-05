import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FacetView } from "./facet-view";
import { getFacetJobs } from "@/lib/queries/jobs";
import {
  FACET_INDEX_MIN,
  facetDescription,
  facetHeading,
  facetKeyFromSlug,
  facetPath,
  facetTitle,
  type FacetAxis,
} from "@/lib/job-facets";
import { breadcrumbJsonLd } from "@/lib/seo";
import { SITE_OPEN_GRAPH } from "@/constants/site";

// 세 랜딩 라우트(`region/`·`position/`·`department/`)가 공유하는 몸통.
//
// 라우트 파일은 Next가 **정적으로 찾아야 하는 것**(`generateStaticParams`·`generateMetadata`·default)만
// 자기 파일에 두고, 안의 판단은 전부 여기로 모은다 — 세 번 반복되던 metadata 조립·404·JSON-LD가 한 벌이 된다
// ("추상화는 3번째에" · CLAUDE 클린 코드). 축은 인자로만 다르다.

/** 랜딩 metadata — 없는 슬러그면 제목만 돌려주고, 얇은 축이면 색인을 요청하지 않는다 */
export async function facetMetadata(axis: FacetAxis, slug: string): Promise<Metadata> {
  const key = facetKeyFromSlug(axis, slug);
  if (key === null) return { title: "페이지를 찾을 수 없습니다" };

  const { total } = await getFacetJobs(axis, key);
  const title = facetTitle(axis, key);
  const description = facetDescription(axis, key, total);
  return {
    title,
    description,
    openGraph: { ...SITE_OPEN_GRAPH, title, description },
    alternates: { canonical: facetPath(axis, key) },
    // 공고가 너무 적은 축은 색인을 요청하지 않는다 — 얇은 페이지가 색인되면 도움이 아니라 해가 된다.
    // 페이지는 계속 열린다(사용자와 내부 링크는 그대로).
    ...(total < FACET_INDEX_MIN ? { robots: { index: false, follow: true } } : {}),
  };
}

/** 랜딩 본문 — 라우트 파일이 `<Suspense>` 안에서 부른다(슬러그가 `params`라 dynamic이다) */
export async function FacetContent({ axis, slug }: { axis: FacetAxis; slug: string }) {
  const key = facetKeyFromSlug(axis, slug);
  if (key === null) notFound();
  const data = await getFacetJobs(axis, key);

  return (
    <>
      {/* BreadcrumbList JSON-LD — 검색 결과에 "민잡 › 청빙 공고 › 경기 사역자 청빙 공고"로 경로가 보인다 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "청빙 공고", path: "/jobs" },
              { name: facetHeading(axis, key) },
            ]),
          ),
        }}
      />
      <FacetView axis={axis} facetKey={key} data={data} />
    </>
  );
}
