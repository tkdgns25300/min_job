"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AdminJobRow } from "@/components/admin/admin-job-row";
import { AdminJobSheet, type SheetState } from "@/components/admin/admin-job-sheet";
import {
  DENOMINATIONS,
  JOB_SOURCES,
  JOB_STATUSES,
  REGIONS,
  type Denomination,
  type JobSource,
  type Region,
} from "@/constants/domain";
import type { AdminJob, JobStatus } from "@/types/domain";

type Tab = "all" | JobStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "PENDING", label: JOB_STATUSES.PENDING },
  { key: "OPEN", label: JOB_STATUSES.OPEN },
  { key: "CLOSED", label: JOB_STATUSES.CLOSED },
];

const SELECT_CLASS =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AdminJobsView({ jobs }: { jobs: AdminJob[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [source, setSource] = useState<"all" | JobSource>("all");
  const [denom, setDenom] = useState<"all" | Denomination>("all");
  const [region, setRegion] = useState<"all" | Region>("all");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);

  const counts = useMemo(
    () => ({
      all: jobs.length,
      PENDING: jobs.filter((j) => j.status === "PENDING").length,
      OPEN: jobs.filter((j) => j.status === "OPEN").length,
      CLOSED: jobs.filter((j) => j.status === "CLOSED").length,
    }),
    [jobs],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (tab !== "all" && j.status !== tab) return false;
      if (source !== "all" && j.source !== source) return false;
      if (denom !== "all" && j.church.denomination !== denom) return false;
      if (region !== "all" && j.church.region !== region) return false;
      if (query && !`${j.title} ${j.church.name}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [jobs, tab, source, denom, region, q]);

  return (
    <div>
      {/* 탭 (상태별) */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(({ key, label }) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "relative -mb-px flex items-center gap-1.5 px-3 py-2 text-sm font-bold whitespace-nowrap",
                on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                  on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[key]}
              </span>
              {on && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
            </button>
          );
        })}
      </div>

      {/* 필터 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="출처 필터"
          className={SELECT_CLASS}
          value={source}
          onChange={(e) => setSource(e.target.value as "all" | JobSource)}
        >
          <option value="all">출처 전체</option>
          {Object.entries(JOB_SOURCES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="교단 필터"
          className={SELECT_CLASS}
          value={denom}
          onChange={(e) => setDenom(e.target.value as "all" | Denomination)}
        >
          <option value="all">교단 전체</option>
          {Object.entries(DENOMINATIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="지역 필터"
          className={SELECT_CLASS}
          value={region}
          onChange={(e) => setRegion(e.target.value as "all" | Region)}
        >
          <option value="all">지역 전체</option>
          {Object.entries(REGIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <Input
          className="h-9 min-w-40 flex-1"
          placeholder="제목·교회 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* 테이블 */}
      <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            조건에 맞는 공고가 없어요.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">공고</th>
                <th className="px-4 py-2.5 font-medium">교회</th>
                <th className="px-4 py-2.5 font-medium">상태</th>
                <th className="px-4 py-2.5 font-medium">노출</th>
                <th className="px-4 py-2.5 font-medium">출처</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">게시일</th>
                <th className="px-4 py-2.5 text-right font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((job) => (
                <AdminJobRow
                  key={job.id}
                  job={job}
                  onEdit={() => setSheet({ job, mode: "edit" })}
                  onFeature={() => setSheet({ job, mode: "feature" })}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdminJobSheet state={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}
