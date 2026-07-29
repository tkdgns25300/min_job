import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { JobForm } from "../job-form";
import { getCurrentUser } from "@/lib/queries/users";
import { getChurch } from "@/lib/queries/churches";
import { hasChurchAccess, loginPathWithNext } from "@/lib/auth";

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
  await connection(); // 인증 의존 페이지 — 요청 시점 렌더 보장
  const user = await getCurrentUser();
  if (!user) redirect(loginPathWithNext("/jobs/new")); // 로그인 후 복귀
  if (!hasChurchAccess(user)) redirect("/mypage/verify"); // 교회 인증 관리자만 등록 (SPEC B)
  const church = user.churchId ? await getChurch(user.churchId) : null;

  return <JobForm mode="create" church={church} />;
}

function FormSkeleton() {
  return <div className="h-[32rem] animate-pulse rounded-2xl bg-muted" />;
}
