"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
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
import type { JobCard as JobCardData } from "@/types/domain";
import {
  facetCounts,
  filterAndSortJobs,
  splitListAds,
  type JobFilterCriteria,
} from "./filter-jobs";
import {
  buildJobsQuery,
  emptySelected,
  MULTI_DIMS,
  PAGE_SIZE_OPTIONS,
  parseJobsUrlState,
} from "./jobs-url-state";

export function JobsView({ jobs }: { jobs: JobCardData[] }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // URL → 초기 상태 (마운트 1회 시드). 이후 동기화는 상태 → URL 단방향(아래 effect).
  const [seed] = useState(() => parseJobsUrlState(sp));
  const [q, setQ] = useState(seed.q);
  const [selected, setSelected] = useState(seed.selected);
  const [payMin, setPayMin] = useState(seed.payMin);
  const [payMax, setPayMax] = useState(seed.payMax);
  const [includeNego, setIncludeNego] = useState(seed.includeNego);
  const [housingOnly, setHousingOnly] = useState(seed.housingOnly);
  const [page, setPage] = useState(seed.page);
  const [pageSize, setPageSize] = useState<number>(seed.pageSize);

  // 필터 판정과 칩 건수가 같은 조건을 봐야 한다 — 한 곳에서 만들어 둘에 넘긴다
  const criteria = useMemo<JobFilterCriteria>(
    () => ({
      q,
      selected,
      payMin: payMin ? Number(payMin) : null,
      payMax: payMax ? Number(payMax) : null,
      includeNego,
      housingOnly,
    }),
    [q, selected, payMin, payMax, includeNego, housingOnly],
  );

  const filtered = useMemo(() => filterAndSortJobs(jobs, criteria), [jobs, criteria]);
  // 칩마다 "고르면 몇 건" — 미상 공고가 조용히 빠지는 걸 누르기 전에 보여 준다(`facetCounts` 머리말)
  const counts = useMemo(() => facetCounts(jobs, criteria), [jobs, criteria]);

  const filterProps: JobFilterProps = {
    selected,
    counts,
    onToggle: (dim, value) => {
      setSelected((prev) => {
        const next = new Set(prev[dim]);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return { ...prev, [dim]: next };
      });
      setPage(1);
    },
    payMin,
    payMax,
    onPay: (which, value) => {
      if (which === "min") setPayMin(value);
      else setPayMax(value);
      setPage(1);
    },
    includeNego,
    onIncludeNego: (v) => {
      setIncludeNego(v);
      setPage(1);
    },
    housingOnly,
    onHousingOnly: (v) => {
      setHousingOnly(v);
      setPage(1);
    },
    onReset: () => {
      setQ("");
      setSelected(emptySelected());
      setPayMin("");
      setPayMax("");
      setIncludeNego(true);
      setHousingOnly(false);
      setPage(1);
    },
  };

  // 광고 로우는 결과 수·페이지 계산에 들어가지 않는다 — 1페이지 맨 위에 최대 5줄 따로 선다(SPEC 수익화 절)
  const { ads, rest } = useMemo(() => splitListAds(filtered), [filtered]);
  const total = rest.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = rest.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const adRows = currentPage === 1 ? ads : [];

  // 활성 필터 수 — 모바일 트리거 배지 + 빈 상태 초기화 버튼 노출 판단
  const activeFilterCount =
    MULTI_DIMS.reduce((n, dim) => n + selected[dim].size, 0) +
    (payMin || payMax ? 1 : 0) +
    (includeNego ? 0 : 1) +
    (housingOnly ? 1 : 0);

  // 상태 → URL 반영 (공유·뒤로가기·딥링크·SEO). 페이지 내 미세 조정이라 히스토리를 더럽히지
  // 않도록 push 대신 replace + scroll 유지. 클램핑된 currentPage를 실어 URL과 화면을 일치시킨다.
  const query = buildJobsQuery({
    q,
    selected,
    payMin,
    payMax,
    includeNego,
    housingOnly,
    page: currentPage,
    pageSize,
  });
  useEffect(() => {
    // 현재 URL과 동일하면 replace 생략(루프 방지). 비정규 순서 딥링크는 mount 시 1회 정규화 후 안정.
    if (query === new URLSearchParams(window.location.search).toString()) return;
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [query, pathname, router]);

  return (
    <div className="space-y-4">
      {/* 검색 + 모바일 필터 트리거 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-primary" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="교회명 · 공고 제목 · 지역 · 직분 검색"
            aria-label="공고 검색"
            className="h-12 rounded-xl pl-12 text-base"
          />
        </div>
        <Sheet>
          <SheetTrigger className={cn(buttonVariants({ variant: "outline" }), "h-12 md:hidden")}>
            필터
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </SheetTrigger>
          {/* `pt-12` — 시트의 닫기 X(absolute top-3 right-3)가 `JobFilter` 머리의 "초기화"와 같은 줄에 겹치지
              않게 머리를 X 아래로 내린다 */}
          <SheetContent side="left" className="w-80 overflow-y-auto p-6 pt-12">
            {/* 제목은 접근성용으로만 — `JobFilter`가 자기 머리("상세 필터 · 초기화")를 그려서 보이는 제목을
                두면 같은 글자가 위아래로 두 번 선다(2026-08-30 전수 점검) */}
            <SheetTitle className="sr-only">상세 필터</SheetTitle>
            <JobFilter {...filterProps} />
          </SheetContent>
        </Sheet>
      </div>

      {/* 기본 `grid-cols-1` — 비워 두면 좁은 폭에서 열이 내용 최소 폭으로 늘어난다(홈 page.tsx 참조) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
          {/* 데스크톱 필터 사이드바 — 홈 사이드바와 같은 카드 문법 */}
          <aside className="hidden md:block">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <JobFilter {...filterProps} />
            </div>
          </aside>

          {/* 목록 — 1페이지 맨 위 광고 로우(스페셜 → 플러스, 필터 통과분만) → 일반 최신순. 한 상자에 이어진다 —
              광고를 별도 상자로 떼면 상단 광고 밴드로 읽힌다(2026-08 폐기). 경계는 로우의 "광고" 텍스트가 말한다 */}
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-y-2 border-b pb-2">
              <p className="text-sm text-muted-foreground">
                총 <b className="text-foreground">{total}</b>건
              </p>
              <div className="flex items-center gap-3 text-sm">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-md border bg-card px-2 py-1 text-muted-foreground"
                  aria-label="페이지당 공고 수"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}개씩
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 활성 필터 요약 — 개별 해제 가능 */}
            <ActiveFilterChips
              selected={selected}
              onToggle={filterProps.onToggle}
              payMin={payMin}
              payMax={payMax}
              onClearPay={() => {
                setPayMin("");
                setPayMax("");
                setPage(1);
              }}
              includeNego={includeNego}
              onIncludeNego={filterProps.onIncludeNego}
              housingOnly={housingOnly}
              onClearHousing={() => {
                setHousingOnly(false);
                setPage(1);
              }}
              onReset={filterProps.onReset}
            />

            {adRows.length + pageItems.length > 0 ? (
              <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
                {adRows.map((job) => (
                  <JobRow key={job.id} job={job} ad />
                ))}
                {pageItems.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </div>
            ) : (
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

            <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
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
