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

export const metadata: Metadata = { title: "공고 수정" };

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
  // 담당자가 여럿이고 교체될 수 있어 작성자로 묶으면 안 된다.
  if (!hasChurchAccess(user)) redirect("/mypage/verify");
  // 운영자 등록 공고는 클레임("가져오기") 전까지 제외 — 대시보드가 managed/claimable을 나눠
  // 보여주므로 여기서 열어주면 화면과 어긋난다(수정해도 source가 OPERATOR로 남아 "가져오세요"가 계속 뜬다).
  const job = await getEditableJob(id, user.churchId);
  if (!job) notFound(); // 남의 교회 공고·미클레임 공고 — 존재 노출 최소화
  // 게이트를 통과했으니 `job.churchId === user.churchId`다. nullable인 공고 쪽 대신
  // 게이트가 보장한 값을 쓴다(`job.churchId`는 미claim 공고에서 null일 수 있는 타입).
  const church = await getChurch(user.churchId);
  // 〃 게이트를 지났으면 값이 온다. 그 사이 인증이 내려갔으면 수정도 막는다.
  if (church === null) redirect("/mypage/verify");

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
