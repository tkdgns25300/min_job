import type { Metadata } from "next";
import { getAdminJobs } from "@/lib/queries/jobs";
import { AdminJobsView } from "./admin-jobs-view";

export const metadata: Metadata = { title: "공고 관리 | 민잡 운영자" };

// 전체 공고 관리 — 목록은 'use cache'(getAdminJobs) 결과, 탭·필터·수정/노출 시트는 client(AdminJobsView).
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
      <AdminJobsView jobs={jobs} />
    </div>
  );
}
