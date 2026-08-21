"use client";

import { useEffect, useRef, useState } from "react";
import { jobRoleLine } from "@/lib/format";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURED_TIERS, JOB_SOURCES, JOB_STATUSES } from "@/constants/domain";
import type { AdminJob, JobStatus } from "@/types/domain";

const STATUS_VARIANT: Record<JobStatus, "default" | "secondary" | "outline"> = {
  OPEN: "default",
  CLOSED: "secondary",
  PENDING: "outline",
};

// status가 OPEN인데 공개 목록에서 내려간 경우 — "게재중"으로 뭉뚱그리면 운영자가
// 자기 사이트에서 뭐가 안 보이는지 알 수 없다 (DATA §6-1). 판정은 lib/job-visibility.
const HIDDEN_LABEL: Record<"deadline" | "stale", string> = {
  deadline: "기간 지남",
  stale: "오래됨",
};

// 케밥 메뉴 — DropdownMenu 미설치라 직접 구현. 테이블이 overflow-x-auto(=overflow-y도 auto)라
// absolute 메뉴가 마지막 행에서 잘림 → body로 portal + fixed 위치로 클리핑 탈출.
// 바깥 클릭·Escape·스크롤·리사이즈에 닫힘 + ARIA. 항목은 mock no-op(Phase 1 Server Action).
function OverflowMenu({
  label,
  items,
}: {
  label: string;
  items: { label: string; destructive?: boolean }[];
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setPos(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPos(null);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setPos(null);
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={`${label} 더보기`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {pos !== null &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-50 w-28 rounded-xl border bg-card p-1 shadow-lg"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => setPos(null)}
                className={cn(
                  "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                  item.destructive && "text-destructive",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export function AdminJobRow({
  job,
  onEdit,
  onFeature,
}: {
  job: AdminJob;
  onEdit: () => void;
  onFeature: () => void;
}) {
  const roleLine = jobRoleLine(job);

  return (
    <tr>
      <td className="px-4 py-3 align-middle">
        <Link href={`/jobs/${job.id}`} className="font-semibold hover:underline">
          {job.title}
        </Link>
        <div className="mt-0.5 text-xs text-muted-foreground">{roleLine}</div>
      </td>
      <td className="px-4 py-3 align-middle whitespace-nowrap">{job.church.name}</td>
      <td className="px-4 py-3 align-middle">
        {job.hiddenReason ? (
          <Badge variant="outline" title="공개 목록에서 내려갔어요">
            {HIDDEN_LABEL[job.hiddenReason]}
          </Badge>
        ) : (
          <Badge variant={STATUS_VARIANT[job.status]}>{JOB_STATUSES[job.status]}</Badge>
        )}
      </td>
      <td className="px-4 py-3 align-middle whitespace-nowrap">
        {job.featuredTier === "NONE" ? (
          <span className="text-xs text-muted-foreground">일반</span>
        ) : (
          <span className="text-xs font-semibold text-gold-ink">
            {FEATURED_TIERS[job.featuredTier]}
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-middle text-xs whitespace-nowrap text-muted-foreground">
        {JOB_SOURCES[job.source]}
      </td>
      <td className="px-4 py-3 align-middle text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {job.postedAt}
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center justify-end gap-1.5">
          {job.status === "CLOSED" ? (
            <>
              <Button variant="outline" size="sm">
                재등록
              </Button>
              <OverflowMenu label={job.title} items={[{ label: "삭제", destructive: true }]} />
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onFeature}>
                노출 설정
              </Button>
              <Button variant="outline" size="sm" onClick={onEdit}>
                수정
              </Button>
              <OverflowMenu
                label={job.title}
                items={[{ label: "마감" }, { label: "삭제", destructive: true }]}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
