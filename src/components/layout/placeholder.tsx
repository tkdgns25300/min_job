import { cn } from "@/lib/utils";

// 스캐폴드용 — 페이지 레이아웃의 각 영역을 표시. 실제 콘텐츠로 교체 예정.
export function Placeholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {label}
    </div>
  );
}
