import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { MypageView } from "./mypage-view";
import { getCurrentUser } from "@/lib/queries/users";
import { getAllJobCards } from "@/lib/queries/jobs";
import { loginPathWithNext } from "@/lib/auth";

export const metadata: Metadata = { title: "마이페이지 | 민잡" };

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
  await connection(); // 인증 의존 — 요청 시점 렌더 (실구현: 쿠키 세션)
  const user = await getCurrentUser();
  if (!user) redirect(loginPathWithNext("/mypage")); // 로그인 후 복귀. 실구현: proxy 게이트
  // 저장한 공고는 클라이언트가 localStorage ID를 읽어 렌더 → 전체 카드를 넘겨 필터.
  // Phase 1: 계정 귀속 bookmarks 테이블 서버 조회로 대체(이 전체-카드 전달은 mock 과도기).
  const allCards = await getAllJobCards();
  return <MypageView user={user} allCards={allCards} />;
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
