"use client";

import { useEffect, useState } from "react";
import { Bookmark, Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isBookmarked, toggleBookmark } from "@/lib/bookmarks";

// 공고 상세 헤더 액션 — 북마크(찜) 토글 + 링크 공유.
// 북마크는 지금 localStorage 저장(로그인 불필요, lib/bookmarks). 계정 귀속은 Phase 1(/mypage).
export function JobActions({ id }: { id: string }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBookmarked(isBookmarked(id));
  }, [id]);

  function onToggleBookmark() {
    setBookmarked(toggleBookmark(id));
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 무시
    }
  }

  return (
    <div className="flex shrink-0 gap-1.5">
      <Button
        type="button"
        variant={bookmarked ? "default" : "outline"}
        size="icon"
        onClick={onToggleBookmark}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "저장 취소" : "저장"}
      >
        <Bookmark className={bookmarked ? "fill-current" : ""} />
      </Button>
      <Button type="button" variant="outline" size="icon" onClick={share} aria-label="공유">
        {copied ? <Check /> : <Share2 />}
      </Button>
    </div>
  );
}
