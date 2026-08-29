"use client";

import { useState } from "react";
import { Bookmark, Check, Share2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useBookmarks } from "./bookmark-provider";

// 공고 상세 헤더 액션 — 북마크(저장) 토글 + 링크 공유.
// 저장 여부·저장 동작은 `useBookmarks`에서 온다(목록 행의 `BookmarkButton`과 같은 소스).
// `disabled` = 미리보기(`/jobs/new`의 `JobPreview`) — 아직 없는 공고라 저장도 공유도 실행되면 안 된다.
export function JobActions({ id, disabled = false }: { id: string; disabled?: boolean }) {
  const { isSaved, toggle } = useBookmarks();
  const [copied, setCopied] = useState(false);
  const bookmarked = isSaved(id);

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ⚠️ **삼키지 않는다.** 클립보드는 권한·브라우저 설정으로 막힐 수 있는데, 그냥 두면
      //    아이콘도 안 바뀌고 아무 말도 없어 **고장으로 읽힌다**(전에는 `// 무시`였다).
      //    성공은 아이콘이 체크로 바뀌어 말하니 토스트를 띄우지 않는다 — 실패만 말한다.
      toast.error("링크를 복사하지 못했습니다.");
    }
  }

  return (
    <div className="flex shrink-0 gap-1.5">
      <Button
        type="button"
        variant={bookmarked ? "default" : "outline"}
        size="icon"
        onClick={() => toggle(id)}
        disabled={disabled}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "저장 취소" : "저장"}
      >
        <Bookmark className={bookmarked ? "fill-current" : ""} />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={share}
        disabled={disabled}
        aria-label="공유"
      >
        {copied ? <Check /> : <Share2 />}
      </Button>
    </div>
  );
}
