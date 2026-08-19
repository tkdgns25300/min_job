"use client";

import { useState } from "react";
import Link from "next/link";
import { MyJobRow } from "./my-job-row";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TabBar } from "@/components/tab-bar";
import type { MyJob } from "@/lib/queries/users";

// "내려감" = status는 OPEN인데 공개 목록에서 빠진 것(마감일 경과·상시모집 90일 초과, DATA §6-1).
// 판정은 seam이 실어 보낸 값을 쓴다(lib/job-visibility) — 여기서 날짜를 다시 계산하지 않는다.
type TabKey = "all" | "open" | "hidden" | "closed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "open", label: "게재 중" },
  { key: "hidden", label: "내려감" },
  { key: "closed", label: "마감" },
];

const EMPTY_MESSAGE: Record<TabKey, string> = {
  all: "공고가 없어요.",
  open: "게재 중인 공고가 없어요.",
  hidden: "내려간 공고가 없어요.",
  closed: "마감된 공고가 없어요.",
};

const MATCHES: Record<Exclude<TabKey, "all">, (job: MyJob) => boolean> = {
  open: (j) => j.isPubliclyOpen,
  hidden: (j) => j.hiddenReason !== null,
  closed: (j) => j.status === "CLOSED",
};

// 교회 공고 목록 — 상태 탭(전체·게재중·마감)으로 필터. 개수는 탭 라벨 배지로.
export function ChurchJobList({ jobs }: { jobs: MyJob[] }) {
  const [tab, setTab] = useState<TabKey>("all");

  const counts: Record<TabKey, number> = {
    all: jobs.length,
    open: jobs.filter(MATCHES.open).length,
    hidden: jobs.filter(MATCHES.hidden).length,
    closed: jobs.filter(MATCHES.closed).length,
  };
  const filtered = tab === "all" ? jobs : jobs.filter(MATCHES[tab]);

  // 빈 상태 — 공고 자체가 없으면 첫 등록 유도, 탭 필터 결과만 비면 탭별 안내
  const emptyMessage =
    jobs.length === 0
      ? "아직 등록한 공고가 없어요. 첫 공고를 등록해 보세요 — 등록은 무료예요."
      : EMPTY_MESSAGE[tab];

  return (
    <div>
      <TabBar tabs={TABS} active={tab} counts={counts} onChange={setTab} />

      {filtered.length > 0 ? (
        <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border bg-card">
          {filtered.map((job) => (
            <MyJobRow key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3 rounded-2xl border border-dashed p-10 text-center">
          <p className="text-sm leading-relaxed break-keep text-muted-foreground">{emptyMessage}</p>
          {jobs.length === 0 && (
            <Link href="/jobs/new" className={cn(buttonVariants({ size: "sm" }))}>
              공고 등록하기
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
