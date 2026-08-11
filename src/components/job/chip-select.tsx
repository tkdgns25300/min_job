import { cn } from "@/lib/utils";

// 칩 선택 컨트롤 — /jobs/new 폼과 /admin/ingest 둘 다 쓰므로 components/로 올렸다
// (CLAUDE.md 배치 규칙: 두 곳 이상에서 쓰면 페이지 폴더 밖으로).

// 칩 하나의 시각 문법 — 단일/다중이 같은 모양이어야 하므로 한 곳에서 관리
function chipClass(selected: boolean): string {
  return cn(
    "rounded-md border px-3 py-1.5 text-sm transition-colors",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:text-foreground",
  );
}

// 다중 선택 칩 그룹 — 직분 전용(한 공고에 여러 직분: 자리가 여럿이거나 자격을 열어둔 경우).
// DATA §3 "여러 자리 판정 규칙". 부서·고용형태 등 나머지는 계속 단일(ChipSelect).
export function ChipMultiSelect<K extends string>({
  options,
  value,
  onChange,
}: {
  options: Record<K, string>;
  value: K[];
  onChange: (value: K[]) => void;
}) {
  const toggle = (key: K) =>
    onChange(value.includes(key) ? value.filter((v) => v !== key) : [...value, key]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.entries(options) as [K, string][]).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value.includes(key)}
          onClick={() => toggle(key)}
          className={chipClass(value.includes(key))}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

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
          className={chipClass(value === key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
