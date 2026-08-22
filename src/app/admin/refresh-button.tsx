"use client";

import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { refreshPublicCache } from "./actions";

// 공개 목록 캐시를 지금 비우는 버튼 — 운영자 홈 전용이라 페이지 폴더에 둔다(CLAUDE.md 배치 규칙).
//
// ⚠️ **효과가 화면에 안 보이는 버튼**이다(캐시를 비울 뿐 이 페이지는 바뀌지 않는다). 그래서 결과
//    문구와 "언제 누르는가"를 함께 적는다 — 없으면 왜 있는 버튼인지 알 수 없다.

export function RefreshButton() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setDone(false);
    setError(null);
    startTransition(async () => {
      try {
        await refreshPublicCache();
        setDone(true);
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
      {done && (
        <p className="mt-1.5 text-xs font-semibold text-primary" role="status">
          새로고침했습니다 — 지금부터 새 공고가 보입니다.
        </p>
      )}
      {error && (
        <p className="mt-1.5 text-xs font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
