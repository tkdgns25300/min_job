import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EXPOSURE_PRODUCTS, PROMOTION_STATUSES, type PromotionStatus } from "@/constants/domain";
import { formatExposurePrice, formatKstDate } from "@/lib/format";
import type { PromotionLedgerRow } from "@/lib/queries/promotions";

// 원장 표 — 순수 프레젠테이션(서버 컴포넌트). 값은 seam이 좁혀서 준다.
// 상태 배지: PAID=default(초록 면) · CANCELLED/REFUNDED=secondary — 돈이 되돌아간 행은 조용히.
const STATUS_VARIANT: Record<PromotionStatus, "default" | "secondary"> = {
  PAID: "default",
  CANCELLED: "secondary",
  REFUNDED: "secondary",
};

export function PromotionLedgerTable({ rows }: { rows: PromotionLedgerRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
        아직 결제 이력이 없습니다.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-2xl text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium whitespace-nowrap">결제일</th>
            <th className="px-4 py-2.5 font-medium">공고</th>
            <th className="px-4 py-2.5 font-medium whitespace-nowrap">등급</th>
            <th className="px-4 py-2.5 font-medium whitespace-nowrap">기간</th>
            <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">금액</th>
            <th className="px-4 py-2.5 font-medium whitespace-nowrap">상태</th>
            <th className="px-4 py-2.5 font-medium whitespace-nowrap">결제번호</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.paymentId}>
              <td className="px-4 py-3 align-middle text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {formatKstDate(row.createdAt)}
              </td>
              <td className="px-4 py-3 align-middle">
                <Link href={`/jobs/${row.jobId}`} className="font-semibold hover:underline">
                  {row.jobTitle}
                </Link>
                <div className="mt-0.5 text-xs text-muted-foreground">{row.churchName}</div>
              </td>
              <td className="px-4 py-3 align-middle whitespace-nowrap">
                {EXPOSURE_PRODUCTS[row.tier].label}
              </td>
              <td className="px-4 py-3 align-middle text-xs whitespace-nowrap tabular-nums">
                {row.startsAt} ~ {row.endsAt}
                <span className="ml-1 text-muted-foreground">({row.weeks}주)</span>
              </td>
              <td className="px-4 py-3 text-right align-middle whitespace-nowrap tabular-nums">
                {formatExposurePrice(row.amount)}
              </td>
              <td className="px-4 py-3 align-middle">
                <Badge variant={STATUS_VARIANT[row.status]}>{PROMOTION_STATUSES[row.status]}</Badge>
              </td>
              {/* 결제번호는 PortOne 콘솔에서 찾는 열쇠 — 전부 보이되 표를 넓히지 않게 작게 */}
              <td className="px-4 py-3 align-middle font-mono text-[11px] text-muted-foreground">
                {row.paymentId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
