import { Suspense } from "react";
import { getAllJobCards, getJobStats } from "@/lib/queries/jobs";
import { JobsView } from "./jobs-view";

export default async function JobsPage() {
  const jobs = await getAllJobCards();
  const stats = await getJobStats();

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
