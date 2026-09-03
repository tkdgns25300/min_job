import type { Metadata } from "next";
import { Suspense } from "react";
import { FacetContent, facetMetadata } from "../../facet-page";
import { FacetSkeleton } from "../../facet-skeleton";
import { facetKeys, facetSlug } from "@/lib/job-facets";

// region 랜딩 — Next가 **정적으로 찾아야 하는 것**만 여기 두고, 판단은 `../../facet-page`가 한다.
// 세 라우트가 축 이름만 다르다.

const AXIS = "region" as const;

type Params = { params: Promise<{ region: string }> };

/** 값이 **닫힌 집합**이라 빌드타임에 다 만든다(공고 상세와 달리 나중에 늘어나지 않는다) */
export function generateStaticParams() {
  return facetKeys(AXIS).map((key) => ({ region: facetSlug(key) }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return facetMetadata(AXIS, (await params).region);
}

export default function FacetPage({ params }: Params) {
  return (
    <Suspense fallback={<FacetSkeleton />}>
      <FacetSlug params={params} />
    </Suspense>
  );
}

/** `params`를 여는 얇은 껍데기 — 본문은 축과 슬러그만 알면 된다 */
async function FacetSlug({ params }: Params) {
  return <FacetContent axis={AXIS} slug={(await params).region} />;
}
