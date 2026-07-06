"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { isBookmarked, toggleBookmark } from "@/lib/bookmarks";

// 책갈피(저장) 토글. 로우/카드의 stretched Link 위에 떠서 자체 클릭을 받는다(z-10).
export function BookmarkButton({ jobId, className }: { jobId: string; className?: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(isBookmarked(jobId));
  }, [jobId]);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "저장 취소" : "저장"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaved(toggleBookmark(jobId));
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
