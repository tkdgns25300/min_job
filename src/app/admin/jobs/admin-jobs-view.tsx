"use client";

import { useMemo, useState } from "react";
import { useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { TabBar } from "@/components/tab-bar";
import { EnumFilterSelect } from "@/components/enum-filter-select";
import { AdminJobRow } from "@/components/admin/admin-job-row";
import { AdminJobSheet, type SheetState } from "@/components/admin/admin-job-sheet";
import {
  DENOMINATIONS,
  FEATURED_TIERS,
  JOB_SOURCES,
  JOB_STATUSES,
  REGIONS,
  type Denomination,
  type FeaturedTier,
  type JobSource,
  type Region,
} from "@/constants/domain";
import type { AdminJob } from "@/types/domain";

// 공고 검수 제거 — 교회 인증이 유일 게이트라 검수중 탭 없음.
// "내려감" = status는 OPEN인데 공개 목록에서 빠진 것(마감일 경과·상시모집 90일 초과, DATA §6-1).
// 운영자가 마감일을 늘릴지 교회에 연락할지 판단하려면 이것만 골라볼 수 있어야 한다.
type Tab = "all" | "OPEN" | "HIDDEN" | "CLOSED";

// 노출 필터 — 홈 "노출중(유료)" 카드가 딥링크하는 축. paid = 유료노출 전체(featuredTier≠NONE)
type FeaturedFilter = "all" | "paid" | FeaturedTier;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "OPEN", label: "게재중" },
  { key: "HIDDEN", label: "내려감" },
  { key: "CLOSED", label: JOB_STATUSES.CLOSED },
];

// URL → 초기 필터 시드 (마운트 1회). 잘못된 값은 기본값으로 폴백(오래된 딥링크 방어).
// 상태→URL 역동기화는 하지 않는다 — 내부 도구라 딥링크 진입만으로 충분(jobs-view보다 단순).
function seedFilters(sp: ReadonlyURLSearchParams) {
  const isKey = <T extends string>(map: Record<T, unknown>, v: string | null): v is T =>
    v !== null && v in map;
  const tab = sp.get("tab");
  const featured = sp.get("featured");
  const source = sp.get("source");
  const denom = sp.get("denom");
  const region = sp.get("region");
  return {
    tab: (tab === "OPEN" || tab === "HIDDEN" || tab === "CLOSED" ? tab : "all") as Tab,
    featured: (featured === "paid" || isKey(FEATURED_TIERS, featured)
      ? featured
      : "all") as FeaturedFilter,
    source: (isKey(JOB_SOURCES, source) ? source : "all") as "all" | JobSource,
    denom: (isKey(DENOMINATIONS, denom) ? denom : "all") as "all" | Denomination,
    region: (isKey(REGIONS, region) ? region : "all") as "all" | Region,
  };
}

export function AdminJobsView({ jobs }: { jobs: AdminJob[] }) {
  const sp = useSearchParams();
  // URL → 초기 상태 (마운트 1회 시드). 이후 필터 변경은 로컬 state만(URL 역반영 없음).
  const [seed] = useState(() => seedFilters(sp));
  const [tab, setTab] = useState<Tab>(seed.tab);
  const [source, setSource] = useState<"all" | JobSource>(seed.source);
  const [denom, setDenom] = useState<"all" | Denomination>(seed.denom);
  const [region, setRegion] = useState<"all" | Region>(seed.region);
  const [featured, setFeatured] = useState<FeaturedFilter>(seed.featured);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);

  const counts = useMemo(
    () => ({
      all: jobs.length,
      OPEN: jobs.filter((j) => j.isPubliclyOpen).length,
      HIDDEN: jobs.filter((j) => j.hiddenReason !== null).length,
      CLOSED: jobs.filter((j) => j.status === "CLOSED").length,
    }),
    [jobs],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (tab === "OPEN" && !j.isPubliclyOpen) return false;
      if (tab === "HIDDEN" && j.hiddenReason === null) return false;
      if (tab === "CLOSED" && j.status !== "CLOSED") return false;
      if (featured === "paid" && j.featuredTier === "NONE") return false;
      if (featured !== "all" && featured !== "paid" && j.featuredTier !== featured) return false;
      if (source !== "all" && j.source !== source) return false;
      if (denom !== "all" && j.church.denomination !== denom) return false;
      if (region !== "all" && j.church.region !== region) return false;
      if (query && !`${j.title} ${j.church.name}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [jobs, tab, featured, source, denom, region, q]);

  return (
    <div>
      {/* 탭 (상태별) */}
      <TabBar tabs={TABS} active={tab} counts={counts} onChange={setTab} />

      {/* 필터 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <EnumFilterSelect label="출처" labels={JOB_SOURCES} value={source} onChange={setSource} />
        <EnumFilterSelect label="교단" labels={DENOMINATIONS} value={denom} onChange={setDenom} />
        <EnumFilterSelect label="지역" labels={REGIONS} value={region} onChange={setRegion} />
        <EnumFilterSelect
          label="노출"
          labels={FEATURED_TIERS}
          value={featured}
          onChange={setFeatured}
          extraOptions={<option value="paid">유료노출만</option>}
        />
        <Input
          className="h-9 min-w-40 flex-1"
          placeholder="제목·교회 검색"
          aria-label="공고 검색"
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
