"use client";

import { useEffect, useRef, useState } from "react";
import { jobRoleLine } from "@/lib/format";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURED_TIERS, JOB_STATUSES, ALWAYS_OPEN_MAX_DAYS } from "@/constants/domain";
import type { JobStatus } from "@/types/domain";
import type { MyJob } from "@/lib/queries/users";

// 상태 배지 위계 — 모집중=default(초록 면), 마감=secondary, 검수중=outline
const STATUS_BADGE_VARIANT: Record<JobStatus, "default" | "secondary" | "outline"> = {
  OPEN: "default",
  CLOSED: "secondary",
  PENDING: "outline",
};

interface MenuItem {
  label: string;
  destructive?: boolean;
}

// 케밥 오버플로우 메뉴 — shadcn DropdownMenu 미설치라 최소 client 구현.
// mock: 항목 클릭은 닫기만. 실제 마감·삭제(확인 다이얼로그 포함)는 Phase 1 Server Action.
function OverflowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`${label} 더보기`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-20 w-32 overflow-hidden rounded-xl border bg-card p-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(
                "block w-full rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-muted",
                item.destructive && "text-destructive",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 마이페이지 관리 행 — 액션은 상태별로: 게재중=수정+⋯(마감·삭제), 마감=재등록+⋯(삭제).
// 삭제·마감은 파괴적/상태변경이라 ⋯ 뒤로(오클릭 방지). 조회·북마크 지표는 집계 준비 중.
// 공개 목록에서 내려간 이유별 안내 — 판정은 lib/job-visibility, 여기는 문구만(도메인 로직 X)
const HIDDEN_NOTICE: Record<"deadline" | "stale", string> = {
  deadline: "마감일이 지나 목록에서 내려갔어요 — 마감일을 늘리면 다시 노출돼요.",
  stale: `게시 후 ${ALWAYS_OPEN_MAX_DAYS}일이 지나 목록에서 내려갔어요 — 갱신하면 다시 노출돼요.`,
};

export function MyJobRow({ job }: { job: MyJob }) {
  const isClosed = job.status === "CLOSED";
  const hidden = job.hiddenReason;
  const roleLine = jobRoleLine(job);

  return (
    <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/jobs/${job.id}`}
            className="truncate font-bold tracking-tight hover:underline"
          >
            {job.title}
          </Link>
          <Badge variant={STATUS_BADGE_VARIANT[job.status]} className="shrink-0">
            {JOB_STATUSES[job.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{roleLine}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {/* 노출 등급 = 텍스트 라벨(정보). 일반은 표시 안 함. 만료일은 Phase 1 */}
          {job.featuredTier !== "NONE" && (
            <span className="font-semibold text-gold-ink">
              {FEATURED_TIERS[job.featuredTier]} 노출 ·{" "}
            </span>
          )}
          {job.postedAt} 게시 · {job.deadline ? `${job.deadline} 마감` : "상시모집"}
        </p>
        {/* 게재중인데 공개 목록에 안 보이는 경우 — 왜 안 보이는지 교회가 알아야 한다(DATA §6-1).
            status는 OPEN이라 배지만으로는 알 수 없어 별도 안내가 필요하다. */}
        {hidden && (
          <p className="mt-1.5 text-xs font-semibold text-gold-ink">{HIDDEN_NOTICE[hidden]}</p>
        )}
        {job.status === "PENDING" ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            검수 중이에요 — 확인이 끝나면 곧 게재돼요.
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">
            조회 · 북마크
            <span className="ml-1.5 rounded border px-1 text-[10px] text-muted-foreground/70">
              집계 준비 중
            </span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {isClosed ? (
          <>
            {/* 재등록 = 이 공고를 다시 올리기. mock: 새 공고 등록으로 이동(프리필은 Phase 1) */}
            <Link
              href="/jobs/new"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              재등록
            </Link>
            <OverflowMenu label={job.title} items={[{ label: "삭제", destructive: true }]} />
          </>
        ) : (
          <>
            {/* 게재중·검수중 = 수정 가능. 마감은 게재중(OPEN)만 — 검수중은 미게재라 삭제만 */}
            <Link
              href={`/jobs/${job.id}/edit`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              수정
            </Link>
            <OverflowMenu
              label={job.title}
              items={
                job.status === "OPEN"
                  ? [{ label: "마감" }, { label: "삭제", destructive: true }]
                  : [{ label: "삭제", destructive: true }]
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
