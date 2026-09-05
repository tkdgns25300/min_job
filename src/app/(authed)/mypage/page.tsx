import type { Metadata } from "next";
import { Suspense } from "react";
import { MypageView } from "./mypage-view";
import { getBookmarkedJobCards } from "@/lib/queries/bookmarks";
import { requireUser } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "마이페이지" };

// 사역자 view — 모든 계정 기본. dynamic(인증 의존). 교회 관리는 /mypage/church.
export default function MyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Suspense fallback={<MypageSkeleton />}>
        <MypageContent />
      </Suspense>
    </div>
  );
}

async function MypageContent() {
  const user = await requireUser();
  // 저장한 공고는 **이 사람 것만** 서버가 꺼낸다(2026-08-28 — 한때 localStorage id와 맞추려고
  // 공고 885건 전부를 내려 보냈다). 최근 본 공고는 여전히 localStorage라 클라이언트가 물어 온다.
  const saved = await getBookmarkedJobCards(user.id);
  return <MypageView user={user} saved={saved} />;
}

function MypageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-14 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
