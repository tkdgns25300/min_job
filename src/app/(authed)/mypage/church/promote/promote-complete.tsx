"use client";

import { useEffect, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { STORAGE_KEYS } from "@/constants/storage";
import { completePromotion, type PromotionResult } from "./actions";
import { PromoteOutcome } from "./promote-outcome";

// 모바일 복귀 — 결제창이 `redirectUrl`에 실어 보낸 `paymentId`로 완료 처리를 **이어간다**.
// PC는 결제 화면(`promote-checkout`) 안에서 SDK 약속이 풀린 직후 같은 액션을 부른다.
// 마운트 1회. 액션이 멱등이라 새로고침으로 다시 와도 두 번 적립되지 않는다.
export function PromoteComplete({ paymentId }: { paymentId: string }) {
  const [result, setResult] = useState<PromotionResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await completePromotion(paymentId);
        if (!cancelled) setResult(next);
      } catch (thrown) {
        unstable_rethrow(thrown);
        console.error("[promote] 완료 처리 실패", thrown);
        // 결제창을 지나 돌아온 뒤의 예외 — 청구는 됐을 수 있다. 재시도로 몰지 않는다
        if (!cancelled) {
          setResult({ ok: false, message: "결제 확인 중 오류가 발생했어요.", charged: true });
        }
      }
      // 결제 화면이 결제창을 띄우며 남긴 번호 — 여기서 결과를 보였으니 다시 이어 확인할 일이 없다
      try {
        window.localStorage.removeItem(STORAGE_KEYS.pendingPromotionPayment);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  if (result === null) {
    return (
      <div className="mt-6 rounded-2xl border bg-card p-8 text-center" aria-busy>
        <p className="text-sm text-muted-foreground">결제를 확인하고 있어요…</p>
      </div>
    );
  }
  return <PromoteOutcome result={result} paymentId={paymentId} />;
}
