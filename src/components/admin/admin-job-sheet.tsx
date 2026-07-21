"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  EXPOSURE_WEEKS,
  FEATURED_TIERS,
  JOB_STATUSES,
  type FeaturedTier,
} from "@/constants/domain";
import type { AdminJob } from "@/types/domain";

export type SheetState = { job: AdminJob; mode: "edit" | "feature" } | null;

const SELECT_CLASS =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// 운영자 공고 편집·노출 설정 시트 — mock. 실 저장(Server Action + updateTag)은 Phase 1.
export function AdminJobSheet({ state, onClose }: { state: SheetState; onClose: () => void }) {
  return (
    <Sheet open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {state?.mode === "edit" && <EditForm job={state.job} onClose={onClose} />}
        {state?.mode === "feature" && <FeatureForm job={state.job} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function EditForm({ job, onClose }: { job: AdminJob; onClose: () => void }) {
  const [title, setTitle] = useState(job.title);

  return (
    <>
      <SheetHeader>
        <SheetTitle>공고 수정</SheetTitle>
        <SheetDescription>{job.church.name}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-muted-foreground">제목</span>
          <Input className="h-9" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-muted-foreground">상태</span>
          <select className={SELECT_CLASS} defaultValue={job.status}>
            {/* 공고 검수 제거 — 검수중(PENDING)은 선택 불가, 모집중/마감만 */}
            {Object.entries(JOB_STATUSES)
              .filter(([key]) => key !== "PENDING")
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <p className="text-xs break-keep text-muted-foreground">
          전체 필드 편집·저장은 Phase 1(실 DB). 지금은 미리보기예요.
        </p>
      </div>
      <SheetFooter className="flex-row justify-end">
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button onClick={onClose}>저장</Button>
      </SheetFooter>
    </>
  );
}

const TIER_OPTIONS: FeaturedTier[] = ["PREMIUM", "HERO", "NONE"];

function FeatureForm({ job, onClose }: { job: AdminJob; onClose: () => void }) {
  const [tier, setTier] = useState<FeaturedTier>(job.featuredTier);
  const [weeks, setWeeks] = useState<number>(2);

  return (
    <>
      <SheetHeader>
        <SheetTitle>노출 설정</SheetTitle>
        <SheetDescription>
          {job.title} · {job.church.name}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">상품</span>
          <div className="flex flex-wrap gap-2">
            {TIER_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                aria-pressed={tier === t}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  tier === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:border-primary",
                )}
              >
                {t === "NONE" ? "노출 해제" : FEATURED_TIERS[t]}
              </button>
            ))}
          </div>
        </div>
        {tier !== "NONE" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">기간</span>
            <div className="flex gap-2">
              {EXPOSURE_WEEKS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeeks(w)}
                  aria-pressed={weeks === w}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                    weeks === w
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:border-primary",
                  )}
                >
                  {w}주
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs break-keep text-muted-foreground">
          노출 적용(featured_until 설정)·결제 연동은 Phase 1. 지금은 미리보기예요.
        </p>
      </div>
      <SheetFooter className="flex-row justify-end">
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button onClick={onClose}>적용</Button>
      </SheetFooter>
    </>
  );
}
