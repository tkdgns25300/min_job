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
  QUALIFICATIONS,
} from "@/constants/domain";
import type { FacetCounts, FilterDim } from "@/types/domain";

const CHIP_LIMIT = 8; // 이보다 많은 그룹은 "더보기"로 접음

const GROUPS: { dim: FilterDim; title: string; options: Record<string, string> }[] = [
  { dim: "denomination", title: "교단", options: DENOMINATIONS },
  { dim: "region", title: "지역", options: REGIONS },
  { dim: "position", title: "직분", options: POSITIONS },
  { dim: "department", title: "담당 부서", options: DEPARTMENTS },
  { dim: "employmentType", title: "고용형태", options: EMPLOYMENT_TYPES },
  { dim: "qualification", title: "자격 / 경력", options: QUALIFICATIONS },
];

/**
 * 접힌 상태에서 보일 칩 — **건수 많은 것부터 고르고, 그리는 순서는 선언 순서를 지킨다.**
 *
 * 선언 순서로 그냥 자르면 세종 3건이 보이고 경북 68건이 숨는다. 칩에 건수가 붙고 0건이 비활성이 된
 * 뒤로는 그게 **살아 있는 칩이 전부 더보기 뒤에 숨는** 화면을 만든다(실측 2026-09-04: 부서=영유아부 +
 * 자격=목사안수 → 보이는 지역 8개가 전부 0건, 유일한 대구는 접힘 뒤). 그 축이 고장 난 것처럼 보인다.
 *
 * ⚠️ **고르기만 건수로 하고 순서는 바꾸지 않는다** — 순서까지 건수로 세우면 필터를 만질 때마다 칩이
 *    자리를 옮겨 누르려던 것을 놓친다. 고른 칩은 0건이어도 남긴다(해제할 자리가 사라지면 안 된다).
 */
function visibleChips(
  entries: [string, string][],
  selected: Set<string>,
  counts: Record<string, number>,
): [string, string][] {
  if (entries.length <= CHIP_LIMIT) return entries;
  const kept = new Set(
    [...entries]
      .sort(
        ([a], [b]) =>
          Number(selected.has(b)) - Number(selected.has(a)) || (counts[b] ?? 0) - (counts[a] ?? 0),
      )
      .slice(0, CHIP_LIMIT)
      .map(([key]) => key),
  );
  return entries.filter(([key]) => kept.has(key));
}

/**
 * 칩 하나 — 라벨 + "고르면 몇 건".
 * ⚠️ `components/job/chip-select`의 폼 칩과는 별개다(그쪽은 건수도 비활성도 없다).
 */
function FilterChip({
  label,
  count,
  selected,
  onToggle,
}: {
  label: string;
  count: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const empty = count === 0 && !selected;
  return (
    <button
      type="button"
      aria-pressed={selected}
      // 라벨과 숫자가 붙어 "유초등부 53"으로 읽히면 무슨 53인지 알 수 없다 — 단위를 붙여 준다
      aria-label={`${label} ${count}건`}
      // 0건 칩은 막는다 — 눌러도 결과가 달라지지 않는다(축 안은 OR라 아무것도 더해지지 않고,
      // 그 축에 고른 게 없으면 총 0건이 된다). 흐리게 남겨 그 조합이 비어 있다는 것은 보인다.
      disabled={empty}
      onClick={onToggle}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-60",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground enabled:hover:text-foreground",
      )}
    >
      {label}
      {/* 고른 칩 위에서도 읽히도록 색이 아니라 투명도로 낮춘다(배경이 primary로 바뀐다).
          ⚠️ 비활성 칩에서는 낮추지 않는다 — 버튼 투명도와 곱해져 0.36이 되면 숫자가 사라지고,
             "비어 있다는 사실을 보여준다"는 이 칩의 목적이 함께 사라진다. */}
      <span className={cn("ml-1", empty ? "opacity-100" : "opacity-60")}>{count}</span>
    </button>
  );
}

function ChipGroup({
  title,
  options,
  selected,
  counts,
  onToggle,
}: {
  title: string;
  options: Record<string, string>;
  selected: Set<string>;
  counts: Record<string, number>;
  onToggle: (value: string) => void;
}) {
  const entries = Object.entries(options);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entries : visibleChips(entries, selected, counts);
  const hasMore = entries.length > CHIP_LIMIT;

  return (
    <div>
      <h3 className="mb-2 text-xs font-bold text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {visible.map(([key, label]) => (
          <FilterChip
            key={key}
            label={label}
            count={counts[key] ?? 0}
            selected={selected.has(key)}
            onToggle={() => onToggle(key)}
          />
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
  /** 칩마다 "고르면 몇 건" — 자기 축을 뺀 나머지 조건이 반영된 수(`facetCounts`) */
  counts: FacetCounts;
  onToggle: (dim: FilterDim, value: string) => void;
  payMin: string;
  payMax: string;
  onPay: (which: "min" | "max", value: string) => void;
  includeNego: boolean;
  onIncludeNego: (value: boolean) => void;
  housingOnly: boolean;
  onHousingOnly: (value: boolean) => void;
  onReset: () => void;
}

export function JobFilter({
  selected,
  counts,
  onToggle,
  payMin,
  payMax,
  onPay,
  includeNego,
  onIncludeNego,
  housingOnly,
  onHousingOnly,
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
          counts={counts[g.dim]}
          onToggle={(v) => onToggle(g.dim, v)}
        />
      ))}

      <div>
        <h3 className="mb-2 text-xs font-bold text-muted-foreground">월 사례비 (만원)</h3>
        {/* 환산 규칙을 드러낸다 — 안 밝히면 "월 300 이상"에 연봉 공고가 걸리는 게 버그로 보인다 */}
        <p className="mb-2 text-xs text-muted-foreground">연 단위 공고는 월로 환산해 비교해요.</p>
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            value={payMin}
            onChange={(e) => onPay("min", e.target.value)}
            placeholder="최소"
            className="h-9"
          />
          <span className="text-muted-foreground">~</span>
          <Input
            inputMode="numeric"
            value={payMax}
            onChange={(e) => onPay("max", e.target.value)}
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

      <div>
        <h3 className="mb-2 text-xs font-bold text-muted-foreground">주거</h3>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={housingOnly}
            onChange={(e) => onHousingOnly(e.target.checked)}
            className="size-4 accent-primary"
          />
          사택 제공만 보기
        </label>
      </div>
    </div>
  );
}
