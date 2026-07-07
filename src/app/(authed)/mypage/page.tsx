import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { MypageView } from "./mypage-view";
import { getCurrentUser, getOwnedJobs } from "@/lib/queries/users";

export const metadata: Metadata = { title: "마이페이지 | 민잡" };

// 인증 페이지 — dynamic (CLAUDE 모드 표). 게이트(proxy)는 Phase 1: 지금은 mock 사용자로 렌더.
export default function MyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Suspense fallback={<MypageSkeleton />}>
        <MypageContent />
      </Suspense>
    </div>
  );
}

async function MypageContent() {
  await connection(); // 인증 의존 페이지 — 요청 시점 렌더 보장 (실구현에선 쿠키 세션이 이 역할)
  const user = await getCurrentUser();
  if (!user) redirect("/login"); // 실구현: proxy 게이트 + /login?next=/mypage
  const myJobs = await getOwnedJobs(user.id);

  return <MypageView user={user} myJobs={myJobs} />;
}

function MypageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-14 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="h-44 animate-pulse rounded-2xl bg-muted" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
