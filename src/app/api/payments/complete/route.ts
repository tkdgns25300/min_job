import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/queries/users";
import { hasChurchAccess } from "@/lib/auth";
import {
  EXPOSURE_PRODUCTS,
  EXPOSURE_WEEKS,
  exposurePrice,
  type ExposureProduct,
} from "@/constants/domain";

// 결제 검증 — 브라우저 결제 후 서버가 PortOne에 실제 결제를 조회해 상태·금액을 대조(위변조 방지).
// 금액은 클라이언트를 믿지 않고 tier·weeks로 서버가 재계산한다.
// ⚠️ **채널이 실연동이라 여기 도달한 결제는 이미 청구가 끝났다.** 그런데 지금은 검증만 하고
//    주문을 저장하지 않는다(`job_promotions` 테이블은 2026-08-20에 생겼지만 쓰는 코드가 없다)
//    — 노출 적용도 하지 않는다.
//    그래서 **적용·취소는 운영자가 PortOne 콘솔을 보고 수동으로** 한다(ROADMAP "결제 초기 수동 처리").
//    결제 경로 자체는 교회 멤버십 미배선으로 아직 아무도 도달하지 못한다(`hasChurchAccess` 항상 false).
// ⚠️ **모바일은 이 라우트가 아예 호출되지 않는다** — redirect 복귀 파라미터를 읽는 코드가 없어
//    검증 없이 청구만 남는다. 운영자가 콘솔에서 확인해야 한다(Phase 1에서 복귀 처리 추가).
// ⏸ Phase 1: 검증 통과 시 주문 저장 + featured_tier·featured_until 설정 + 모바일 redirect 복귀.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasChurchAccess(user)) {
    return NextResponse.json({ ok: false, reason: "권한 없음" }, { status: 401 });
  }

  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "결제 검증 키 미설정" }, { status: 500 });
  }

  const body = (await request.json()) as {
    paymentId?: unknown;
    tier?: unknown;
    weeks?: unknown;
    jobId?: unknown;
  };
  const { paymentId, tier, weeks, jobId } = body;
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
    if (paid) {
      // 주문을 저장할 테이블이 없어 **로그가 우리 쪽 유일한 흔적**이다 — 운영자가 수동으로
      // 노출을 적용·취소할 때 무엇을 누구에게 할지 여기서 찾는다(PortOne 콘솔과 교차 확인).
      console.info(
        "[payments/complete] 결제 확인 — 수동 적용 필요",
        JSON.stringify({ paymentId, tier, weeks, amount: expected, jobId, email: user.email }),
      );
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({
      ok: false,
      reason: `결제 상태·금액 불일치 (${payment.status ?? "unknown"})`,
    });
  } catch (e) {
    console.error("[payments/complete] 검증 오류", e);
    return NextResponse.json({ ok: false, reason: "결제 검증 중 오류" }, { status: 502 });
  }
}
