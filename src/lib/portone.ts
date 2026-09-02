// PortOne V2 REST — **서버 전용**(API secret). 하는 일은 둘뿐이다: 결제 한 건 조회(검증)와 전액 취소.
//
// 브라우저 결제창이 끝난 뒤 우리 서버가 **PortOne에 직접 물어** 상태·금액을 대조한다 — 클라이언트가 보낸
// 값은 신뢰 경계 밖이다. 문서: https://developers.portone.io/api/rest-v2/payment
//
// 실연동 채널이라 여기 도달한 결제는 카드가 실제로 청구된 것이다. 취소도 진짜 환불이다 — 정원 경합에
// 져서 자리를 줄 수 없을 때만 부른다(`promote/actions.ts`).

const API_BASE = "https://api.portone.io";

/** 결제 한 건 — 이 파일이 읽는 칸만. `customData`는 SDK가 객체를 **문자열로** 저장한다 */
export interface PortOnePayment {
  status: string;
  amount: { total: number };
  /** ISO 4217 — 금액 대조는 통화까지 맞아야 뜻이 있다(채널이 KRW 전용인 건 우연이다) */
  currency: string;
  customData: string | null;
}

function authHeaders(): HeadersInit {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) throw new Error("PORTONE_API_SECRET 미설정");
  return { Authorization: `PortOne ${secret}`, "Content-Type": "application/json" };
}

/** 결제 단건 조회. 없는 결제(404)는 null, 그 외 실패는 던진다 */
export async function getPayment(paymentId: string): Promise<PortOnePayment | null> {
  const res = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`결제 조회 실패 (${res.status})`);
  const body = (await res.json()) as {
    status?: string;
    amount?: { total?: number };
    currency?: string;
    customData?: string | null;
  };
  return {
    status: body.status ?? "UNKNOWN",
    amount: { total: body.amount?.total ?? 0 },
    currency: body.currency ?? "UNKNOWN",
    customData: body.customData ?? null,
  };
}

/** 전액 취소(환불). 응답의 취소 상태를 돌려준다 — `SUCCEEDED`가 아니면 호출부가 운영자 확인으로 넘긴다 */
export async function cancelPayment(paymentId: string, reason: string): Promise<string> {
  const res = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`결제 취소 실패 (${res.status})`);
  const body = (await res.json()) as { cancellation?: { status?: string } };
  return body.cancellation?.status ?? "UNKNOWN";
}
