import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JobRow } from "@/components/job/job-row";
import type { FacetJobs } from "@/lib/queries/jobs";
import {
  facetHeading,
  facetJobsHref,
  siblingFacets,
  type FacetAxis,
  type FacetGroup,
} from "@/lib/job-facets";

// 지역·직분·부서 랜딩의 화면 — 세 라우트가 나눠 쓴다(`region/`·`position/`·`department/`).
// 배치 규칙: 한 기능 안에서 여러 페이지가 공유하는 것은 **그 기능 폴더의 공용 파일**로 둔다.
//
// **공고 목록만 그리지 않는다.** 필터 라벨만 다른 얇은 페이지는 검색엔진이 "대량 생성 페이지"로 보고,
// 그러면 페이지를 만든 목적 자체가 뒤집힌다. 그래서 분포 블록(교단·시·군·직분·부서)을 함께 그린다 —
// 우리는 구조화된 데이터를 갖고 있어 이게 공짜이고, 그 항목들이 그대로 **내부 링크 그물**이 된다.

export function FacetView({
  axis,
  facetKey,
  data,
}: {
  axis: FacetAxis;
  facetKey: string;
  data: FacetJobs;
}) {
  const heading = facetHeading(axis, facetKey);
  const siblings = siblingFacets(axis, facetKey);
  // 공고가 20건 이하여도 링크를 남긴다 — 그러지 않으면 얇은 랜딩에 `/jobs`로 가는 길이 아예 없다
  const hasJobs = data.jobs.length > 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="mb-5 rounded-2xl border border-primary/15 bg-primary/[0.04] px-6 py-6 sm:px-8">
        <nav className="mb-1.5 text-sm text-muted-foreground">
          <Link href="/jobs" className="transition-colors hover:text-foreground">
            청빙 공고
          </Link>
        </nav>
        <h1 className="text-2xl font-bold">{heading}</h1>
        <p className="mt-2 text-sm font-semibold text-primary">지금 모집 중 {data.total}건</p>
      </header>

      {data.jobs.length === 0 ? (
        <EmptyState heading={heading} />
      ) : (
        <>
          <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
            {data.jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
          {/* 나머지는 `/jobs`가 받는다 — 필터를 시드하는 기존 쿼리 모양이라 화면이 바로 걸러진다.
              ⚠️ 문구에 **건수를 넣지 않는다** — 이 랜딩은 사역직만 세지만 `/jobs`는 일반직까지 보여줘
              (같은 지역이면 몇 건 더 많다) 링크가 약속한 숫자와 도착지가 어긋난다. */}
          {hasJobs && (
            <Link
              href={facetJobsHref(axis, facetKey)}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border bg-card px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-muted/40"
            >
              {heading} 전체 보기
              <ArrowRight className="size-4" />
            </Link>
          )}
        </>
      )}

      {data.groups.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">{heading} 한눈에 보기</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.groups.map((group) => (
              <GroupCard key={group.label} group={group} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-bold">{AXIS_MORE[axis]}</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {siblings.map((sibling) => (
            <li key={sibling.href}>
              <Link
                href={sibling.href}
                className="inline-flex rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted/40"
              >
                {sibling.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** 형제 링크 블록의 제목 — 축마다 부르는 말이 다르다 */
const AXIS_MORE: Record<FacetAxis, string> = {
  region: "다른 지역 공고",
  position: "다른 직분 공고",
  department: "다른 부서 공고",
};

function GroupCard({ group }: { group: FacetGroup }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground">{group.label}</p>
      <ul className="mt-2 space-y-1.5">
        {group.items.map((item) => (
          <li key={item.label} className="flex items-baseline justify-between gap-2 text-sm">
            {item.href ? (
              <Link
                href={item.href}
                className="truncate underline-offset-2 transition-colors hover:text-primary hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className="truncate">{item.label}</span>
            )}
            <span className="shrink-0 tabular-nums text-muted-foreground">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 공고가 0건인 축 — 페이지는 살려 둔다(그 축의 링크가 사이트 곳곳에 있고, 다음 크롤에 다시 채워진다).
 * 색인은 페이지가 `robots: noindex`로 막는다(`FACET_INDEX_MIN`).
 */
function EmptyState({ heading }: { heading: string }) {
  return (
    <div className="rounded-xl border bg-card px-6 py-12 text-center">
      <p className="text-sm break-keep text-muted-foreground">
        지금은 {heading}가 없어요. 새 공고는 매일 들어오니 조금 뒤에 다시 확인해 주세요.
      </p>
      <Link
        href="/jobs"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        전체 공고 보기
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
