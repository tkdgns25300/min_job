"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { refreshPublicCache } from "./actions";

// 공개 목록 캐시를 지금 비우는 버튼 — 운영자 홈 전용이라 페이지 폴더에 둔다(CLAUDE.md 배치 규칙).
//
// ⚠️ **효과가 다른 화면에서 일어나는 버튼**이다(비우는 것은 공개 목록 캐시다). 그래서 결과 문구와
//    "언제 누르는가"를 함께 적는다 — 없으면 왜 있는 버튼인지 알 수 없다.
// ⚠️ **`router.refresh()`를 반드시 부른다.** `updateTag`은 캐시를 비우지만 **지금 보고 있는 화면을
//    다시 그려 주지는 않는다**(액션 응답에 새 트리가 실려 오지 않는 것을 실측했다). 안 부르면
//    "새로고침했습니다"를 띄우면서 이 페이지의 요약 수치는 옛 값으로 남아 운영자를 헷갈리게 한다.

export function RefreshButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      try {
        await refreshPublicCache();
        router.refresh(); // 위 ⚠️ — 이 페이지의 요약 수치도 새로 읽는다
        toast.success("공개 목록을 새로 불러왔습니다.");
      } catch (thrown) {
        unstable_rethrow(thrown); // 운영자가 아니면 notFound가 온다 — 삼키지 않는다
        console.error("[admin] 캐시 새로고침 실패", thrown);
        setError("새로고침하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <div>
      <Button variant="outline" disabled={pending} onClick={run}>
        {pending ? "새로고침 중…" : "공개 목록 새로고침"}
      </Button>
      {error && (
        <p className="mt-1.5 text-xs font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
