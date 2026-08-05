"use client";

import { X } from "lucide-react";
import {
  DENOMINATIONS,
  REGIONS,
  POSITIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  QUALIFICATIONS,
} from "@/constants/domain";
import type { FilterDim } from "@/types/domain";

const DIM_OPTIONS: Record<FilterDim, Record<string, string>> = {
  denomination: DENOMINATIONS,
  region: REGIONS,
  position: POSITIONS,
  department: DEPARTMENTS,
  employmentType: EMPLOYMENT_TYPES,
  qualification: QUALIFICATIONS,
};

// 사례비 입력값 → 요약 라벨 ("200~300만원" / "200만원 이상" / "300만원 이하")
function stipendLabel(min: string, max: string): string | null {
  if (min && max) return `사례비 ${min}~${max}만원`;
  if (min) return `사례비 ${min}만원 이상`;
  if (max) return `사례비 ${max}만원 이하`;
  return null;
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/[0.06] py-1 pr-1.5 pl-2.5 text-xs text-foreground/80">
      {label}
      <button
        type="button"
        aria-label={`${label} 필터 해제`}
        onClick={onRemove}
        className="rounded-full p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

// 활성 필터 요약 칩 — 모바일에서 Sheet를 닫아도 무엇이 걸려 있는지 보이게 (SPEC.md /jobs).
// 추천 검색어 칩과 같은 옅은 초록 면 문법. 필터가 없으면 렌더하지 않는다.
export function ActiveFilterChips({
  selected,
  onToggle,
  stipendMin,
  stipendMax,
  onClearStipend,
  includeNego,
  onIncludeNego,
  housingOnly,
  onClearHousing,
  onReset,
}: {
  selected: Record<FilterDim, Set<string>>;
  onToggle: (dim: FilterDim, value: string) => void;
  stipendMin: string;
  stipendMax: string;
  onClearStipend: () => void;
  includeNego: boolean;
  onIncludeNego: (value: boolean) => void;
  housingOnly: boolean;
  onClearHousing: () => void;
  onReset: () => void;
}) {
  const dims = Object.keys(DIM_OPTIONS) as FilterDim[];
  const stipend = stipendLabel(stipendMin, stipendMax);
  const hasAny =
    dims.some((d) => selected[d].size > 0) || stipend !== null || !includeNego || housingOnly;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {dims.flatMap((dim) =>
        [...selected[dim]].map((value) => (
          <Chip
            key={`${dim}-${value}`}
            label={DIM_OPTIONS[dim][value] ?? value}
            onRemove={() => onToggle(dim, value)}
          />
        )),
      )}
      {stipend && <Chip label={stipend} onRemove={onClearStipend} />}
      {!includeNego && <Chip label="협의 공고 제외" onRemove={() => onIncludeNego(true)} />}
      {housingOnly && <Chip label="사택 제공만" onRemove={onClearHousing} />}
      <button
        type="button"
        onClick={onReset}
        className="px-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        전체 초기화
      </button>
    </div>
  );
}
