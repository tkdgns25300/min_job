import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { JobForm } from "../job-form";
import { getChurch } from "@/lib/queries/churches";
import { requireUser } from "@/lib/auth-guard";
import { hasChurchAccess } from "@/lib/auth";

export const metadata: Metadata = { title: "공고 등록 | 민잡" };

// 인증 페이지 — dynamic. 등록 무료 강조(거부감 완화, pricing과 동일 메시지).
export default function JobNewPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">공고 등록</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          등록은 무료입니다. 몇 분이면 올릴 수 있어요.
        </p>
      </header>
      <Suspense fallback={<FormSkeleton />}>
        <NewJobFormLoader />
      </Suspense>
    </div>
  );
}

async function NewJobFormLoader() {
  const user = await requireUser();
  if (!hasChurchAccess(user)) redirect("/mypage/verify"); // 교회 인증 관리자만 등록 (SPEC B)
  const church = await getChurch(user.churchId);
  // 게이트를 지났으면 값이 온다(`getChurch`는 APPROVED만 돌려주고 `hasChurchAccess`가 그것을 봤다).
  // 그 사이 인증이 내려간 경우만 여기 걸린다 — 폼을 그리지 않고 인증 화면으로 보낸다.
  if (church === null) redirect("/mypage/verify");

  return <JobForm mode="create" church={church} />;
}

function FormSkeleton() {
  return <div className="h-[32rem] animate-pulse rounded-2xl bg-muted" />;
}
