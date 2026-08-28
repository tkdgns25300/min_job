import type { Metadata } from "next";
import { Suspense } from "react";
import { MypageView } from "./mypage-view";
import { getSavedJobCards } from "@/lib/queries/jobs";
import { requireUser } from "@/lib/auth-guard";

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
  const user = await requireUser();
  // 저장한 공고·최근 본 공고는 클라이언트가 localStorage ID를 읽어 렌더 → 전체 카드를 넘겨 필터.
  // 두 목록이 **같은 배열**을 나눠 쓴다 — 최근 목록을 카드로 그리게 바꿔도 전달량은 늘지 않았다.
  // ⬜ 북마크가 localStorage라서 서버가 전체 카드를 넘긴다 — 계정 귀속(`bookmarks` 테이블)으로
  //    옮기면 id로 조회해 이 전달을 없앤다(ROADMAP). 공고가 3천 건이 되면 이 페이지가 가장 무겁다.
  const allCards = await getSavedJobCards();
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
