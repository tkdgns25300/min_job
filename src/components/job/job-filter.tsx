"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DENOMINATIONS,
  REGIONS,
  POSITIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  CHURCH_SIZES,
  UNKNOWN_SIZE,
} from "@/constants/domain";
import type { FilterDim } from "@/types/domain";

const CHIP_LIMIT = 8; // 이보다 많은 그룹은 "더보기"로 접음
const SIZE_OPTIONS: Record<string, string> = { ...CHURCH_SIZES, [UNKNOWN_SIZE]: "미상" };

const GROUPS: { dim: FilterDim; title: string; options: Record<string, string> }[] = [
  { dim: "denomination", title: "교단", options: DENOMINATIONS },
  { dim: "region", title: "지역", options: REGIONS },
  { dim: "position", title: "직분", options: POSITIONS },
  { dim: "department", title: "담당 부서", options: DEPARTMENTS },
  { dim: "employmentType", title: "고용형태", options: EMPLOYMENT_TYPES },
  { dim: "size", title: "교회 규모", options: SIZE_OPTIONS },
];

function ChipGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: Record<string, string>;
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const entries = Object.entries(options);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entries : entries.slice(0, CHIP_LIMIT);
  const hasMore = entries.length > CHIP_LIMIT;

  return (
    <div>
      <h3 className="mb-2 text-xs font-bold text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {visible.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              selected.has(key)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? "접기" : `더보기 +${entries.length - CHIP_LIMIT}`}
          </button>
        )}
      </div>
    </div>
  );
}

export interface JobFilterProps {
  selected: Record<FilterDim, Set<string>>;
  onToggle: (dim: FilterDim, value: string) => void;
  stipendMin: string;
  stipendMax: string;
  onStipend: (which: "min" | "max", value: string) => void;
  includeNego: boolean;
  onIncludeNego: (value: boolean) => void;
  onReset: () => void;
}

export function JobFilter({
  selected,
  onToggle,
  stipendMin,
  stipendMax,
  onStipend,
  includeNego,
  onIncludeNego,
  onReset,
}: JobFilterProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">상세 필터</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          초기화
        </button>
      </div>

      {GROUPS.map((g) => (
        <ChipGroup
          key={g.dim}
          title={g.title}
          options={g.options}
          selected={selected[g.dim]}
          onToggle={(v) => onToggle(g.dim, v)}
        />
      ))}

      <div>
        <h3 className="mb-2 text-xs font-bold text-muted-foreground">월 사례비 (만원)</h3>
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            value={stipendMin}
            onChange={(e) => onStipend("min", e.target.value)}
            placeholder="최소"
            className="h-9"
          />
          <span className="text-muted-foreground">~</span>
          <Input
            inputMode="numeric"
            value={stipendMax}
            onChange={(e) => onStipend("max", e.target.value)}
            placeholder="최대"
            className="h-9"
          />
        </div>
        <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeNego}
            onChange={(e) => onIncludeNego(e.target.checked)}
            className="size-4 accent-primary"
          />
          협의 공고 포함
        </label>
      </div>
    </div>
  );
}
