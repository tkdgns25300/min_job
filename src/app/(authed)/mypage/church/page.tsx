import type { Metadata } from "next";
import { Suspense } from "react";
import { ChurchView } from "./church-view";
import { getChurchDashboard } from "@/lib/queries/users";
import type { ChurchDashboard } from "@/lib/queries/users";
import { requireUser } from "@/lib/auth-guard";
import { hasChurchAccess } from "@/lib/auth";

export const metadata: Metadata = { title: "교회 공고 관리 | 민잡" };

// 교회 관리 view — dynamic(인증 의존). 인증 완료(APPROVED)면 대시보드, 아니면 게이트 화면.
export default function ChurchManagePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <Suspense fallback={<ChurchSkeleton />}>
        <ChurchContent />
      </Suspense>
    </div>
  );
}

async function ChurchContent() {
  const user = await requireUser();

  let dashboard: ChurchDashboard | null = null;
  if (hasChurchAccess(user)) {
    dashboard = await getChurchDashboard(user.churchId);
  }

  return <ChurchView user={user} dashboard={dashboard} />;
}

function ChurchSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-14 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
