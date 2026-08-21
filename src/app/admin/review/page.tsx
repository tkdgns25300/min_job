import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOperator } from "@/lib/auth-guard";
import { todayInSeoul } from "@/lib/job-visibility";
import {
  getPendingCount,
  getReviewDone,
  getReviewDoneCount,
  getReviewQueue,
  getReviewedTodayCount,
} from "@/lib/queries/review";
import { ReviewQueueView } from "./review-queue-view";

export const metadata: Metadata = { title: "수집 검수 | 민잡 운영자" };

// 수집 검수 — 크롤러가 "사람이 봐야 답이 나온다"고 판단한 공고만 온다(SPEC 수집 검수 절).
// dynamic: 미검수 데이터는 판정하는 순간 바뀌고, 포스터 signed URL은 만료가 있어 캐시할 수 없다.
// 셸 헤더는 정적, 목록은 <Suspense>로 스트리밍.
export default function AdminReviewPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">수집 검수</h1>
        <p className="mt-1 text-sm break-keep text-muted-foreground">
          크롤러가 <b>사람이 봐야 답이 나온다</b>고 판단한 공고만 여기 옵니다. 확인할 게 없는 공고는
          이미 공개됐고, 교회가 직접 올린 공고는 검수하지 않습니다.
        </p>
      </header>
      <Suspense fallback={<QueueSkeleton />}>
        <QueueContent />
      </Suspense>
    </div>
  );
}

async function QueueContent() {
  // 운영자 전용 · 미검수 데이터 — proxy가 1차로 막지만 여기서도 다시 확인한다(fail-closed).
  await requireOperator();

  // 서로를 기다릴 이유가 없다 — 순서대로 await하면 왕복이 직렬로 쌓인다.
  const [queue, done, doneTotal, pending, reviewedToday] = await Promise.all([
    getReviewQueue(),
    getReviewDone(),
    getReviewDoneCount(),
    getPendingCount(),
    getReviewedTodayCount(todayInSeoul()),
  ]);

  return (
    <ReviewQueueView
      queue={queue}
      done={done}
      doneTotal={doneTotal}
      pending={pending}
      reviewedToday={reviewedToday}
    />
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-16 w-64 max-w-full animate-pulse rounded-xl bg-muted" />
      <div className="h-9 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
