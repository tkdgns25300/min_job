import type { Metadata } from "next";
import { Suspense } from "react";
import { getAdminJobs } from "@/lib/queries/jobs";
import { AdminJobsView } from "./admin-jobs-view";

export const metadata: Metadata = { title: "공고 관리 | 민잡 운영자" };

// 전체 공고 관리 — 목록은 'use cache'(getAdminJobs) 결과, 탭·필터·수정/노출 시트는 client(AdminJobsView).
// AdminJobsView가 useSearchParams(딥링크 시드)를 읽으므로 <Suspense>로 감싼다 — 정적 셸 유지(cacheComponents).
export default async function AdminJobsPage() {
  const jobs = await getAdminJobs();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">공고 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">전체 공고 · 상태 · 노출</p>
        </div>
        <span className="text-sm text-muted-foreground">
          전체 <b className="font-semibold text-foreground tabular-nums">{jobs.length}</b>건
        </span>
      </header>
      <Suspense fallback={<AdminJobsSkeleton />}>
        <AdminJobsView jobs={jobs} />
      </Suspense>
    </div>
  );
}

// 목록 영역 스켈레톤 — 탭바 + 필터바 + 테이블 높이로 searchParams 시드 동안 레이아웃 시프트 방지
function AdminJobsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
      <div className="h-9 w-full max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl border bg-muted/40" />
    </div>
  );
}
