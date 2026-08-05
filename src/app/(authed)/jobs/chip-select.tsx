import { cn } from "@/lib/utils";

// 단일 선택 칩 그룹 — JobFilter의 칩 토글 문법 재사용(선택=bg-primary text-primary-foreground).
// 보는 화면(필터)과 쓰는 화면(폼)의 어휘 통일 (SPEC.md /jobs/new). 같은 칩 재클릭 = 해제.
export function ChipSelect<K extends string>({
  options,
  value,
  onChange,
}: {
  options: Record<K, string>;
  value: K | null;
  onChange: (value: K | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.entries(options) as [K, string][]).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(value === key ? null : key)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm transition-colors",
            value === key
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
