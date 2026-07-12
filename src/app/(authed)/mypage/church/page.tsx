import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ChurchView } from "./church-view";
import { getChurchDashboard, getCurrentUser } from "@/lib/queries/users";
import type { ChurchDashboard } from "@/lib/queries/users";
import { hasChurchAccess } from "@/lib/auth";
import type { CurrentUser } from "@/types/domain";

export const metadata: Metadata = { title: "교회 공고 관리 | 민잡" };

// 교회 관리 view — dynamic(인증 의존). 인증 완료(APPROVED)면 대시보드, 아니면 게이트.
export default function ChurchManagePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <Suspense fallback={<ChurchSkeleton />}>
        <ChurchContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ChurchContent({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  await connection(); // 인증 의존 — 요청 시점 렌더 (실구현: 쿠키 세션)
  const base = await getCurrentUser();
  if (!base) redirect("/login"); // 실구현: proxy 게이트 + /login?next=/mypage/church
  const { preview } = await searchParams;
  const user = applyMockPreview(base, preview);

  let dashboard: ChurchDashboard | null = null;
  if (hasChurchAccess(user) && user.churchId) {
    dashboard = await getChurchDashboard(user.churchId);
  }

  return <ChurchView user={user} dashboard={dashboard} />;
}

// ⚠️ mock 전용 — `?preview=none|pending|rejected` 로 인증 상태별 화면 미리보기.
// 실 인증(Phase 1)에선 세션이 상태를 결정하므로 이 함수는 삭제한다.
function applyMockPreview(user: CurrentUser, preview?: string): CurrentUser {
  switch (preview) {
    case "none":
      return { ...user, churchId: null, churchName: null, churchVerificationStatus: null };
    case "pending":
      return { ...user, churchVerificationStatus: "PENDING" };
    case "rejected":
      return { ...user, churchVerificationStatus: "REJECTED" };
    default:
      return user; // 기본 = 인증 완료(mock)
  }
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
