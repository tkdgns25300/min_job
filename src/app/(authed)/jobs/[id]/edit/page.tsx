import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { JobForm } from "../../job-form";
import { JobStatusPanel } from "./status-panel";
import { getEditableJob } from "@/lib/queries/users";
import { getChurch } from "@/lib/queries/churches";
import { requireUser } from "@/lib/auth-guard";
import { hasChurchAccess } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "공고 수정 | 민잡" };

// 인증 + 소유권 페이지 — dynamic. 등록 폼을 그대로 공유(초기값·카피만 다름).
export default function JobEditPage({ params }: Params) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Suspense fallback={<EditSkeleton />}>
        <EditContent params={params} />
      </Suspense>
    </div>
  );
}

async function EditContent({ params }: Params) {
  const { id } = await params;
  const user = await requireUser();

  // 편집 권한 = 그 공고 church_id의 인증 관리자 (작성자 일치 아님 — 가드레일 #2·DATA §4).
  // 담당자가 여럿이고 교체될 수 있어 작성자로 묶으면 안 된다. 운영자 공고 수정은 admin에서.
  if (!hasChurchAccess(user)) redirect("/mypage/verify");
  const job = await getEditableJob(id, user.churchId);
  if (!job) notFound(); // 남의 교회 공고 — 존재 노출 최소화
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
