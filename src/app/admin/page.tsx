import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminStatus } from "./admin-status";
import { STATUS_SECTIONS, StatusSection } from "./status-cards";

export const metadata: Metadata = { title: "운영자 홈 | 민잡 운영자" };

// 운영자 홈 — **"지금 손댈 게 있나"에 답하는 화면**. 하루 한두 번 열어 대부분은 "이상 없음"만
// 확인하고 닫으므로, 평상시엔 조용하고 이상이 있을 때만 눈에 띄게 만든다(색은 그때만 쓴다).
//
// ⛔ **크롤 경보를 여기서 판정하지 않는다** — 게시판 건강·죽음 판정은 크롤러 `alerts_for`가 정본이고
//    `minjob-ingest status`가 보여준다. 이 화면은 웹에서만 알 수 있는 것을 맡는다: 우리 검수·인증 큐,
//    `isPubliclyOpen`으로 갈리는 공개/내려감, 그리고 웹에서만 누를 수 있는 캐시 새로고침.
//    수집은 **마지막 실행 시각 한 줄**만 —"할 일 없음"과 "며칠째 안 돌렸음"이 웹에서 구별되지 않아서다.
//
// 본문이 dynamic이라 페이지는 `◐`다(셸은 계속 프리렌더). 사이드바에 대기 건수 배지를 달지 않는
// 이유가 여기 있다 — 셸은 레이아웃이고, 거기에 캐시 못 하는 값을 넣으면 `/admin/jobs`의 `○`까지 잃는다.
export default function AdminHomePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold">운영자 홈</h1>
        <p className="mt-1 text-xs text-muted-foreground">처리할 일과 지금 상태.</p>
      </header>

      <Suspense fallback={<StatusSkeleton />}>
        <AdminStatus />
      </Suspense>
    </div>
  );
}

// 값이 도착할 때 화면이 밀리지 않게 — **구획 제목까지 그대로** 그린다(제목은 `STATUS_SECTIONS` 공유).
// 높이는 실제 카드에 맞춘 것이다: 처리할 일 96px · 수집 112px · 공개 120px.
function StatusSkeleton() {
  return (
    <div className="space-y-6">
      <StatusSection title={STATUS_SECTIONS.tasks}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        </div>
      </StatusSection>
      <StatusSection title={STATUS_SECTIONS.crawl}>
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      </StatusSection>
      <StatusSection title={STATUS_SECTIONS.publish}>
        <div className="h-30 animate-pulse rounded-2xl bg-muted" />
      </StatusSection>
    </div>
  );
}
