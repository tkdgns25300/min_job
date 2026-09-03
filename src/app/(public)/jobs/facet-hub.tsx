import Link from "next/link";
import type { FacetCountsByAxis } from "@/lib/queries/jobs";
import { FACET_AXES, facetLabel, type FacetAxis } from "@/lib/job-facets";

// `/jobs` 하단 허브 — 랜딩 28개의 **발견 경로**다(sitemap과 한 쌍).
// 페이지는 조립만 하므로 이 표시 덩어리는 자기 파일로 둔다(같은 기능 폴더 공용 · `facet-view`와 같은 결).

/**
 * 지역·직분·부서 랜딩으로 가는 허브 — 이 페이지가 랜딩 28개의 **발견 경로**다(sitemap과 한 쌍).
 * 건수가 0인 축은 링크째 뺀다(빈 페이지로 보내지 않는다). 색인 판정은 랜딩 페이지가 스스로 한다.
 */
export function FacetHub({ facets }: { facets: FacetCountsByAxis }) {
  return (
    <nav className="mt-10 border-t pt-8" aria-label="지역·직분·부서로 보기">
      <h2 className="text-lg font-bold">조건으로 모아 보기</h2>
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {FACET_AXES.map((axis) => (
          <div key={axis}>
            <p className="text-xs font-semibold text-muted-foreground">{AXIS_TITLE[axis]}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {facets[axis]
                .filter((facet) => facet.count > 0)
                .map((facet) => (
                  <li key={facet.key}>
                    <Link
                      href={facet.path}
                      className="inline-flex items-baseline gap-1 rounded-full border bg-card px-2.5 py-1 text-[13px] transition-colors hover:bg-muted/40"
                    >
                      {facetLabel(axis, facet.key)}
                      <span className="tabular-nums text-muted-foreground">{facet.count}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

const AXIS_TITLE: Record<FacetAxis, string> = {
  region: "지역별",
  position: "직분별",
  department: "부서별",
};
