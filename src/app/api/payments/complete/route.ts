import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/queries/users";
import { hasChurchAccess } from "@/lib/auth";
import { EXPOSURE_PRODUCTS, EXPOSURE_WEEKS, exposurePrice, type ExposureProduct } from "@/constants/domain";

// 결제 검증 — 브라우저 결제 후 서버가 PortOne에 실제 결제를 조회해 상태·금액을 대조(위변조 방지).
// 금액은 클라이언트를 믿지 않고 tier·weeks로 서버가 재계산한다.
// ⚠️ Phase 1: 검증 통과 시 주문 저장 + featured_tier·featured_until 설정. 지금은 검증만(데이터 mock).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasChurchAccess(user)) {
    return NextResponse.json({ ok: false, reason: "권한 없음" }, { status: 401 });
  }

  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "결제 검증 키 미설정" }, { status: 500 });
  }

  const body = (await request.json()) as { paymentId?: unknown; tier?: unknown; weeks?: unknown };
  const { paymentId, tier, weeks } = body;
  if (
    typeof paymentId !== "string" ||
    typeof tier !== "string" ||
    !(tier in EXPOSURE_PRODUCTS) ||
    typeof weeks !== "number" ||
    !(EXPOSURE_WEEKS as readonly number[]).includes(weeks)
  ) {
    return NextResponse.json({ ok: false, reason: "잘못된 요청" }, { status: 400 });
  }

  const expected = exposurePrice(tier as ExposureProduct, weeks);

  try {
    const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `PortOne ${secret}` },
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: "결제 조회 실패" }, { status: 502 });
    }
    const payment = (await res.json()) as { status?: string; amount?: { total?: number } };
    const paid = payment.status === "PAID" && payment.amount?.total === expected;
    return paid
      ? NextResponse.json({ ok: true })
      : NextResponse.json({
          ok: false,
          reason: `결제 상태·금액 불일치 (${payment.status ?? "unknown"})`,
        });
  } catch (e) {
    console.error("[payments/complete] 검증 오류", e);
    return NextResponse.json({ ok: false, reason: "결제 검증 중 오류" }, { status: 502 });
  }
}
