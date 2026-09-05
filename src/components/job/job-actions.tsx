"use client";

import { useState } from "react";
import { Bookmark, Check, Share2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useBookmarks } from "./bookmark-provider";
import { track } from "@/lib/analytics";

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
      // 아이콘이 체크로 바뀌는 것만으로는 **무엇이 됐는지**를 말하지 않는다 — 공유 버튼이 링크를 복사한다는
      // 것 자체를 모르는 사람이 많다(운영자 지적 2026-08-30). 성공=토스트 규칙(CLAUDE.md Styling)대로 말한다.
      toast.success("링크를 복사했습니다.");
      track({ name: "share", params: { method: "copy", content_type: "job", item_id: id } });
    } catch {
      // ⚠️ **삼키지 않는다.** 클립보드는 권한·브라우저 설정으로 막힐 수 있는데, 그냥 두면
      //    아이콘도 안 바뀌고 아무 말도 없어 **고장으로 읽힌다**(전에는 `// 무시`였다).
      //    인라인 자리가 없는 아이콘 버튼이라 실패도 토스트다(규칙의 예외 — `bookmark-button`과 같다).
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
