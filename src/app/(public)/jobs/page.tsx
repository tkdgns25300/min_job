import { Suspense } from "react";
import type { Metadata } from "next";
import { getAllJobCards, getFacetCounts, getJobStats } from "@/lib/queries/jobs";
import { FacetHub } from "./facet-hub";
import { JobsView } from "./jobs-view";

export const metadata: Metadata = {
  title: "사역자 청빙 공고 — 교단·지역·사례비로 검색 | 민잡",
  description:
    "부목사·전도사·담임 청빙 공고를 한곳에서. 교단·지역·부서·사례비로 검색하고 비교하세요.",
  // ⚠️ 필터·정렬·페이지 쿼리가 붙은 URL(?region=…&page=2…)이 각각 별도 페이지로 색인되면
  //    중복 페이지가 폭발하고 크롤링 예산을 낭비한다 → 대표 URL을 /jobs 하나로 고정한다.
  //    지금은 옳다: 필터는 100% 클라이언트 상태라 쿼리가 달라도 **서버 HTML이 동일**하고,
  //    페이지네이션도 <a href>가 아니라 버튼이라 크롤러가 따라갈 링크가 없다.
  // ⚠️ 단 URL을 서버 소스로 승격하면(jobs-url-state 주석 참조) 고유 콘텐츠가 생기므로
  //    이 canonical을 **반드시 재검토**할 것.
  // ✅ 지역·직분·부서 SEO는 **전용 랜딩 라우트**가 맡는다(2026-09-03 · `lib/job-facets`).
  //    쿼리 흡수는 그대로 둔다 — 랜딩이 자기 canonical을 갖고, 필터 쿼리는 계속 이 URL로 모인다.
  //    그래서 이 페이지의 전제(필터 100% 클라이언트)도 바뀌지 않았다: 서버 필터링은 랜딩 안에서만 한다.
  alternates: { canonical: "/jobs" },
};

export default async function JobsPage() {
  // 세 조회가 서로를 기다릴 이유가 없다(앞의 둘은 한때 직렬이었다)
  const [jobs, stats, facets] = await Promise.all([
    getAllJobCards(),
    getJobStats(),
    getFacetCounts(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      {/* 검색 존 — 옅은 초록 밴드로 정의 + 살아있는 현황 신호. 정적(SEO용 H1 유지), 검색바는 바로 아래 JobsView */}
      <div className="mb-5 rounded-2xl border border-primary/15 bg-primary/[0.04] px-6 py-6 sm:px-8">
        <h1 className="text-2xl font-bold">사역자 청빙</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          교회 청빙 공고를 한곳에서. 교단·지역·사례비로 검색하고 비교하세요.
        </p>
        <p className="mt-2 text-sm font-semibold text-primary">
          지금 모집 중 {stats.openCount}건 · 이번 주 새 공고 {stats.newThisWeek}건
        </p>
      </div>
      <Suspense fallback={<JobsListSkeleton />}>
        <JobsView jobs={jobs} />
      </Suspense>
      <FacetHub facets={facets} />
    </div>
  );
}

// 목록 영역 스켈레톤 — JobRow 6행 높이로 레이아웃 시프트 방지
function JobsListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
      <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2.5 px-4 py-4 sm:px-5">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
