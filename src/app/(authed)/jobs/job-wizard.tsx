import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// 공고 등록 위저드 크롬 — 상단 단계 진행바 + 스텝 안 섹션 타임라인. JobForm이 조합.
export const STEP_TITLES = ["모집 기본", "처우·서류", "지원·마감"] as const;
export const TOTAL_STEPS = STEP_TITLES.length;

// 상단 진행바 — 큰 단계(3) 위치
export function StepBar({ step }: { step: number }) {
  return (
    <div className="mb-5 flex gap-2">
      {STEP_TITLES.map((label, i) => {
        const n = i + 1;
        const reached = n <= step;
        return (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <span className={cn("h-1 rounded-full", reached ? "bg-primary" : "bg-border")} />
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-bold",
                n === step ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-[18px] items-center justify-center rounded-full text-[11px] text-primary-foreground",
                  reached ? "bg-primary" : "bg-border",
                )}
              >
                {n}
              </span>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// 스텝 안 섹션 — 왼쪽 타임라인(점으로 구분 + 선으로 연결). 스크롤에 따라 현재 섹션 강조.
export function FlowSection({
  title,
  optional,
  description,
  state,
  last,
  children,
}: {
  title: string;
  optional?: boolean;
  description?: string;
  state: "todo" | "active" | "done";
  last: boolean;
  children: ReactNode;
}) {
  return (
    <div data-fsec className="relative flex gap-4 pb-10">
      <div className="relative w-4 shrink-0">
        {!last && <span className="absolute top-2 -bottom-10 left-[7px] w-0.5 bg-border" />}
        <span
          className={cn(
            "absolute top-0.5 left-0 size-4 rounded-full border-2 bg-card transition-colors",
            state === "active" && "border-primary ring-4 ring-primary/10",
            state === "done" && "border-primary bg-primary",
            state === "todo" && "border-border",
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <h2
          className={cn(
            "flex items-center gap-2 text-[15px] font-bold transition-colors",
            state === "active" && "text-primary",
          )}
        >
          {title}
          {optional && (
            <span className="rounded border px-1.5 py-px text-[11px] font-semibold text-muted-foreground">
              선택
            </span>
          )}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-3.5 space-y-4">{children}</div>
      </div>
    </div>
  );
}
