import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOperator } from "@/lib/auth-guard";
import { getPromotionLedger } from "@/lib/queries/promotions";
import { PromotionLedgerTable } from "./promotion-ledger-table";

export const metadata: Metadata = { title: "노출 원장" };

// 노출 구매 원장 — **읽기만**. 결제·취소·환불 이력을 한 표로 본다(정산 대조·문의 응대).
// dynamic(운영자 전용 · 결제가 들어오는 순간 바뀐다 · 'use cache' 금지). 셸 헤더는 정적, 표는 <Suspense>.
// ⛔ 여기서 상태를 바꾸는 버튼은 두지 않는다 — 환불은 PortOne 콘솔에서 하고, 원장 상태는 그 결과를 적는 자리다
//    (지금은 운영자가 DB에서 직접 · 환불 도구는 만들지 않기로 했다 2026-09-02).
export default function AdminPromotionsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">노출 원장</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          노출 결제 이력 — 최근 것부터. 정원 판정은 PAID 행만 센다.
        </p>
      </header>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-muted" />}>
        <LedgerContent />
      </Suspense>
    </div>
  );
}

async function LedgerContent() {
  await requireOperator();
  const rows = await getPromotionLedger();
  return <PromotionLedgerTable rows={rows} />;
}
