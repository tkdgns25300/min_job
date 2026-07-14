"use client";

import { useState } from "react";
import Link from "next/link";
import { MyJobRow } from "./my-job-row";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MyJob } from "@/lib/queries/users";

type TabKey = "all" | "open" | "closed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "open", label: "게재 중" },
  { key: "closed", label: "마감" },
];

// 교회 공고 목록 — 상태 탭(전체·게재중·마감)으로 필터. 개수는 탭 라벨 배지로.
export function ChurchJobList({ jobs }: { jobs: MyJob[] }) {
  const [tab, setTab] = useState<TabKey>("all");

  const counts: Record<TabKey, number> = {
    all: jobs.length,
    open: jobs.filter((j) => j.status === "OPEN").length,
    closed: jobs.filter((j) => j.status === "CLOSED").length,
  };
  const filtered =
    tab === "all"
      ? jobs
      : jobs.filter((j) => (tab === "open" ? j.status === "OPEN" : j.status === "CLOSED"));

  // 빈 상태 — 공고 자체가 없으면 첫 등록 유도, 탭 필터 결과만 비면 탭별 안내
  const emptyMessage =
    jobs.length === 0
      ? "아직 등록한 공고가 없어요. 첫 공고를 등록해 보세요 — 등록은 무료예요."
      : tab === "open"
        ? "게재 중인 공고가 없어요."
        : tab === "closed"
          ? "마감된 공고가 없어요."
          : "공고가 없어요.";

  return (
    <div>
      <div className="flex gap-1 border-b">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "relative -mb-px flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-bold transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[t.key]}
              </span>
              {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
            </button>
          );
        })}
      </div>

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
