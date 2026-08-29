"use client";

import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBookmarks } from "./bookmark-provider";

// 책갈피(저장) 토글. 로우/카드의 stretched Link 위에 떠서 자체 클릭을 받는다(z-10).
// 저장 여부·저장 동작은 전부 `useBookmarks`에서 온다 — 이 버튼은 그리기만 한다.
export function BookmarkButton({ jobId, className }: { jobId: string; className?: string }) {
  const { isSaved, toggle } = useBookmarks();
  const saved = isSaved(jobId);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "저장 취소" : "저장"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(jobId);
      }}
      className={cn(
        "relative z-10 shrink-0 rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:text-primary",
        saved && "text-primary",
        className,
      )}
    >
      <Bookmark className={cn("size-5", saved && "fill-current")} />
    </button>
  );
}
