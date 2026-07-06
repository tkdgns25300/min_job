"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { JobRow } from "@/components/job/job-row";
import { FeaturedJobCard } from "@/components/job/featured-job-card";
import { JobFilter, type JobFilterProps } from "@/components/job/job-filter";
import { Pagination } from "@/components/job/pagination";
import { RecentlyViewed } from "@/components/job/recently-viewed";
import { cn } from "@/lib/utils";
import type { FilterDim, JobCard as JobCardData, SortKey } from "@/types/domain";
import { filterAndSortJobs } from "./filter-jobs";

const PAGE_SIZE = 8;
const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "최신순" },
  { key: "stipend", label: "사례비순" },
  { key: "deadline", label: "마감임박순" },
];
const MULTI_DIMS: FilterDim[] = [
  "denomination",
  "region",
  "position",
  "department",
  "employmentType",
];

function emptySelected(): Record<FilterDim, Set<string>> {
  return Object.fromEntries(MULTI_DIMS.map((d) => [d, new Set<string>()])) as Record<
    FilterDim,
    Set<string>
  >;
}

export function JobsView({ jobs, ads }: { jobs: JobCardData[]; ads: JobCardData[] }) {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [selected, setSelected] = useState<Record<FilterDim, Set<string>>>(() => {
    const init = emptySelected();
    for (const dim of MULTI_DIMS) init[dim] = new Set(sp.getAll(dim));
    return init;
  });
  const [stipendMin, setStipendMin] = useState(sp.get("stipendMin") ?? "");
  const [stipendMax, setStipendMax] = useState(sp.get("stipendMax") ?? "");
  const [includeNego, setIncludeNego] = useState(true);
  const [sort, setSort] = useState<SortKey>((sp.get("sort") as SortKey) || "recent");
  const [page, setPage] = useState(1);

  const filterProps: JobFilterProps = {
    selected,
    onToggle: (dim, value) => {
      setSelected((prev) => {
        const next = new Set(prev[dim]);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return { ...prev, [dim]: next };
      });
      setPage(1);
    },
    stipendMin,
    stipendMax,
    onStipend: (which, value) => {
      if (which === "min") setStipendMin(value);
      else setStipendMax(value);
      setPage(1);
    },
    includeNego,
    onIncludeNego: (v) => {
      setIncludeNego(v);
      setPage(1);
    },
    onReset: () => {
      setQ("");
      setSelected(emptySelected());
      setStipendMin("");
      setStipendMax("");
      setIncludeNego(true);
      setPage(1);
    },
  };

  const filtered = useMemo(
    () =>
      filterAndSortJobs(jobs, {
        q,
        selected,
        stipendMin: stipendMin ? Number(stipendMin) : null,
        stipendMax: stipendMax ? Number(stipendMax) : null,
        includeNego,
        sort,
      }),
    [jobs, q, selected, stipendMin, stipendMax, includeNego, sort],
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* 검색 + 모바일 필터 트리거 */}
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="교회명 · 지역 · 직분 검색"
          aria-label="공고 검색"
          className="h-10 flex-1"
        />
        <Sheet>
          <SheetTrigger className={cn(buttonVariants({ variant: "outline" }), "md:hidden")}>
            필터
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto p-6">
            <SheetTitle className="mb-2">상세 필터</SheetTitle>
            <JobFilter {...filterProps} />
          </SheetContent>
        </Sheet>
      </div>

      {/* 추천 청빙 = 대표광고 슬롯 (상단 고정, 필터와 무관) */}
      {ads.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold">추천 청빙</h2>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              대표광고
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {ads.map((job) => (
              <FeaturedJobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          {/* 데스크톱 필터 사이드바 */}
          <aside className="hidden md:block">
            <div className="rounded-lg border p-4 md:sticky md:top-16">
              <JobFilter {...filterProps} />
            </div>
          </aside>

          {/* 목록 (프리미엄 상단 고정, 대표광고는 위 AD 섹션) */}
          <div className="min-w-0 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <p className="text-sm text-muted-foreground">
                총 <b className="text-foreground">{total}</b>건
              </p>
              <div className="flex gap-3 text-sm">
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSort(s.key);
                      setPage(1);
                    }}
                    className={cn(
                      "text-muted-foreground hover:text-foreground",
                      sort === s.key && "font-bold text-foreground",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {pageItems.length > 0 ? (
              <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
                {pageItems.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                조건에 맞는 공고가 없어요.
              </p>
            )}

            <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>

        {/* 우측 레일 — 최근 본 공고 + 배너 광고 슬롯 */}
        <aside className="hidden space-y-5 lg:block">
          <RecentlyViewed />
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground">광고</p>
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              배너 광고 자리 (기독 B2B)
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
