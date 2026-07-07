"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { JobRow } from "@/components/job/job-row";
import { ActiveFilterChips } from "@/components/job/active-filter-chips";
import { JobFilter, type JobFilterProps } from "@/components/job/job-filter";
import { Pagination } from "@/components/job/pagination";
import { RecentlyViewed } from "@/components/job/recently-viewed";
import { ChurchCtaCard } from "@/components/job/church-cta-card";
import { cn } from "@/lib/utils";
import type { FilterDim, JobCard as JobCardData, SortKey } from "@/types/domain";
import { filterAndSortJobs } from "./filter-jobs";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
// TODO(design): ❓ 정렬 축 재검토 — 사례비순은 "세상적"(인터뷰), 마감임박은 교회 마감 개념이 모호.
// 최신순 단일 + 마감 "표기만"으로 축소하는 안 vs 현행 3축 유지 — 사람 결정 필요 (fable.md #1)
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
  // TODO(design): ❓ 필터 상태 ↔ URL 동기화(공유·뒤로가기·SEO)를 mock 단계에 선반영할지,
  // DB 전환(URL을 단일 소스로 승격)과 함께 할지 — 사람 결정 필요 (fable.md #2)
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
  const [pageSize, setPageSize] = useState<number>(20);

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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  // 대표광고(HERO)는 리스트 최상단에 통합 — 필터와 무관, 1페이지에만 노출
  const showAds = currentPage === 1 && ads.length > 0;

  // 활성 필터 수 — 모바일 트리거 배지 + 빈 상태 초기화 버튼 노출 판단
  const activeFilterCount =
    MULTI_DIMS.reduce((n, dim) => n + selected[dim].size, 0) +
    (stipendMin || stipendMax ? 1 : 0) +
    (includeNego ? 0 : 1);

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
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto p-6">
            <SheetTitle className="mb-2">상세 필터</SheetTitle>
            <JobFilter {...filterProps} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
          {/* 데스크톱 필터 사이드바 — 홈 사이드바와 같은 카드 문법 */}
          <aside className="hidden md:block">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <JobFilter {...filterProps} />
            </div>
          </aside>

          {/* 목록 — 대표광고 최상단 통합 → 프리미엄 상단 고정 → 일반 */}
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

            {/* 활성 필터 요약 — 개별 해제 가능 */}
            <ActiveFilterChips
              selected={selected}
              onToggle={filterProps.onToggle}
              stipendMin={stipendMin}
              stipendMax={stipendMax}
              onClearStipend={() => {
                setStipendMin("");
                setStipendMax("");
                setPage(1);
              }}
              includeNego={includeNego}
              onIncludeNego={filterProps.onIncludeNego}
              onReset={filterProps.onReset}
            />

            {showAds || pageItems.length > 0 ? (
              <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
                {showAds && ads.map((job) => <JobRow key={job.id} job={job} />)}
                {pageItems.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </div>
            ) : null}

            {pageItems.length === 0 && (
              <div className="space-y-4 py-12 text-center">
                <p className="text-sm text-muted-foreground">조건에 맞는 공고가 없어요.</p>
                {(activeFilterCount > 0 || q.trim() !== "") && (
                  <button
                    type="button"
                    onClick={filterProps.onReset}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    필터 초기화
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                페이지당
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-md border bg-card px-2 py-1 text-sm text-foreground"
                  aria-label="페이지당 공고 수"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}개
                    </option>
                  ))}
                </select>
              </label>
              <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>
        </div>

        {/* 우측 레일 — 최근 본 공고 + 교회 CTA (스크롤 따라 고정) */}
        <aside className="hidden space-y-5 lg:sticky lg:top-20 lg:block">
          <RecentlyViewed />
          <ChurchCtaCard />
        </aside>
      </div>
    </div>
  );
}
