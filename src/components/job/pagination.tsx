"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 페이지 번호 — **현재 페이지 앞뒤 몇 개만** 그리고 나머지는 줄임표다. 한때 47페이지를 전부 나열해
// 번호가 화면 폭을 넘쳤다(2026-08-29). 첫·끝 페이지는 항상 보이고, 이전·다음이 붙는다.

/** 현재 페이지 양옆에 몇 개까지 보이나 — 1 … 5 [6] 7 … 47 꼴 */
const SIBLINGS = 1;
const ELLIPSIS = "…";

/**
 * 그릴 항목 — 번호 또는 줄임표. 첫·끝은 늘 넣고, 현재 ±SIBLINGS를 넣은 뒤 빈 틈을 줄임표로 메운다.
 * 틈이 한 칸이면 줄임표 대신 그 번호를 그린다(`1 … 3`보다 `1 2 3`이 낫다).
 */
function pageItems(page: number, totalPages: number): (number | typeof ELLIPSIS)[] {
  const wanted = new Set<number>([1, totalPages]);
  for (let p = page - SIBLINGS; p <= page + SIBLINGS; p += 1) {
    if (p >= 1 && p <= totalPages) wanted.add(p);
  }
  const sorted = [...wanted].sort((a, b) => a - b);

  const items: (number | typeof ELLIPSIS)[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined) {
      if (p - prev === 2) items.push(prev + 1);
      else if (p - prev > 2) items.push(ELLIPSIS);
    }
    items.push(p);
  });
  return items;
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
  const items = pageItems(page, totalPages);

  return (
    <nav aria-label="페이지" className="flex flex-wrap items-center justify-center gap-1 pt-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        이전
      </button>
      {items.map((item, i) =>
        item === ELLIPSIS ? (
          // 줄임표 사이에 같은 값이 두 번 올 수 있어 자리(index)로 키를 준다
          <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground" aria-hidden>
            {ELLIPSIS}
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: item === page ? "default" : "outline", size: "icon-sm" }),
            )}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        다음
      </button>
    </nav>
  );
}
