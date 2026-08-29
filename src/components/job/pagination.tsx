"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 페이지 번호 — `« ‹ 1 2 3 4 5 › »` + 아래 `8 / 46`. 게시판에서 익숙한 모양이라 손이 기억한다(운영자 결정 2026-08-30).
// · 번호는 **5개씩 묶어** 현재 페이지가 든 묶음만(1~5 · 6~10 · …). 묶음 안 이동은 번호로.
// · ‹ ›는 **묶음 경계를 넘긴다** — 5에서 ›는 6(다음 묶음 첫 장), 6에서 ‹는 5(이전 묶음 끝 장). ±1로 두면
//   번호 버튼과 역할이 겹친다.
// · « »는 처음·끝. 묶음으로 자르면 "끝이 어딘지"가 사라져서(전엔 46이 늘 보였다) 끝 버튼과 `8 / 46`으로 되살린다.
// 한때 현재 앞뒤 하나 + 첫·끝 + 줄임표(`1 … 7 [8] 9 … 46`)였는데 줄임표가 번호 사이를 끊어 읽기 나빴고,
// 그전엔 47페이지를 전부 나열해 화면 폭을 넘쳤다(2026-08-29).

/** 한 묶음에 보이는 페이지 수 — 아이콘 4개와 합쳐 9칸이라 390px에서도 한 줄이다 */
const BLOCK_SIZE = 5;

/** 현재 페이지가 든 묶음의 첫·끝 번호 — 마지막 묶음은 남은 만큼만(`46`이 혼자 서도 그대로) */
function pageBlock(page: number, totalPages: number): { start: number; end: number } {
  const start = Math.floor((page - 1) / BLOCK_SIZE) * BLOCK_SIZE + 1;
  return { start, end: Math.min(start + BLOCK_SIZE - 1, totalPages) };
}

/** 화살표 버튼 — 아이콘만 보이므로 이름은 `aria-label`·`title`로 */
function ArrowButton({
  label,
  target,
  disabled,
  onPageChange,
  children,
}: {
  label: string;
  target: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onPageChange(target)}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
    >
      {children}
    </button>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const { start, end } = pageBlock(page, totalPages);
  const numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav aria-label="페이지" className="flex flex-col items-center gap-2 pt-2">
      <div className="flex flex-wrap items-center justify-center gap-1">
        <ArrowButton label="처음" target={1} disabled={page <= 1} onPageChange={onPageChange}>
          <ChevronsLeft />
        </ArrowButton>
        <ArrowButton
          label="이전 묶음"
          target={start - 1}
          disabled={start <= 1}
          onPageChange={onPageChange}
        >
          <ChevronLeft />
        </ArrowButton>
        {numbers.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: p === page ? "default" : "outline", size: "icon-sm" }),
            )}
          >
            {p}
          </button>
        ))}
        <ArrowButton
          label="다음 묶음"
          target={end + 1}
          disabled={end >= totalPages}
          onPageChange={onPageChange}
        >
          <ChevronRight />
        </ArrowButton>
        <ArrowButton
          label="끝"
          target={totalPages}
          disabled={page >= totalPages}
          onPageChange={onPageChange}
        >
          <ChevronsRight />
        </ArrowButton>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {page} / {totalPages}
      </p>
    </nav>
  );
}
