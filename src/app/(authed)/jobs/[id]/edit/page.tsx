import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { JobForm } from "../../job-form";
import { JobStatusPanel } from "./status-panel";
import { getCurrentUser, getEditableJob } from "@/lib/queries/users";
import { getChurch } from "@/lib/queries/churches";

type Params = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "공고 수정 | 민잡" };

// 인증 + 소유권 페이지 — dynamic. 등록 폼을 그대로 공유(초기값·카피만 다름).
export default function JobEditPage({ params }: Params) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <Suspense fallback={<EditSkeleton />}>
        <EditContent params={params} />
      </Suspense>
    </div>
  );
}

async function EditContent({ params }: Params) {
  const { id } = await params;
  await connection(); // 인증 의존 페이지 — 요청 시점 렌더 보장
  const user = await getCurrentUser();
  if (!user) redirect("/login"); // 실구현: /login?next=/jobs/{id}/edit

  // 소유권 검사 — 남의 공고·운영자 공고(owner 없음)는 notFound(존재 노출 최소화, 가드레일 #2).
  // 운영자 공고 수정은 여기가 아니라 admin에서.
  const job = await getEditableJob(id, user.id);
  if (!job) notFound();
  const church = await getChurch(job.churchId);

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold">공고 수정</h1>
        <p className="mt-1.5 truncate text-sm text-muted-foreground">{job.title}</p>
      </header>
      <JobForm mode="edit" church={church} initialJob={job} />
      <JobStatusPanel job={job} />
    </>
  );
}

function EditSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-14 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-[28rem] animate-pulse rounded-2xl bg-muted" />
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
