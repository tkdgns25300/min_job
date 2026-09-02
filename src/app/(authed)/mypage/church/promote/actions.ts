"use server";

import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth-guard";
import { hasChurchAccess } from "@/lib/auth";
import {
  exposurePrice,
  isExposureProduct,
  isExposureWeeks,
  type ExposureProduct,
  type ExposureWeeks,
  type PromotionStatus,
} from "@/constants/domain";
import {
  firstFullWeek,
  isAllowedStart,
  isExtension,
  isIsoDate,
  lostCapacityRace,
  mondayOf,
  pendingWindow,
  promotionPeriod,
  weeklySales,
  weeksOf,
  type PromotionPeriod,
} from "@/lib/exposure-order";
import { addDays, todayInSeoul } from "@/lib/job-visibility";
import { cancelPayment, getPayment } from "@/lib/portone";
import { getPaidPromotionsOverlapping } from "@/lib/queries/promotions";
import { createClient } from "@/lib/supabase/server";

// 노출 결제 완료 — **원장에 적고 공고에 노출을 건다.** 결제창(브라우저)이 끝나면 여기로 온다:
// PC는 SDK 약속이 풀리는 즉시, 모바일은 `redirectUrl`로 돌아온 화면이 URL의 `paymentId`로.
//
// Server Action인 이유(2026-09-02 확정): 적용 직후 `updateTag("jobs")`로 캐시를 비워 교회가 홈·목록에서
// 자기 광고를 **바로** 본다. route handler는 `revalidateTag`만 가능해 다음 방문자가 옛 목록을 본다.
// 그래서 `/api/payments/complete`는 없앴다(CLAUDE "REST 라우트 금지"의 예외 하나가 줄었다).
//
// **주문은 PortOne이 들고 있다.** 결제창에 실은 `customData`(공고·등급·주수·시작 주)를 결제 조회로 다시 읽는다 —
// 클라이언트가 한 번 더 보낸 값을 믿지 않고, 모바일 복귀처럼 우리 쪽 상태가 사라진 뒤에도 같은 답이 나온다.
// 금액은 등급·주수로 **서버가 재계산**해 PortOne이 받은 금액·통화와 대조한다(위변조·다른 상품 결제 방어).
//
// ⚠️ 실연동 채널이라 여기 도달한 결제는 **카드가 이미 청구됐다.** 그래서 실패는 두 갈래로 갈라 답한다:
//  · `charged: false` — 청구가 없었거나 **우리가 전액 취소했다**(주문 불일치·자리 없음·경합). 다시 시도해도 안전하다.
//    취소한 결제는 원장에 CANCELLED로 남긴다 — 정산 대조·문의 응대가 원장 표(`/admin/promotions`)에서 끝나게.
//  · `charged: true`  — 청구됐는데 적용도 취소도 못 했다. 화면은 재시도 대신 결제번호와 문의 수단을 보여준다.
// 멱등성은 `job_promotions.payment_id UNIQUE`다 — 같은 결제가 두 번 들어와도 노출이 두 번 적립되지 않는다.
//
// **한 공고는 창 하나** — 캐시 컬럼(`featured_*`)이 한 창이라 두 창을 겹쳐 두면 하나가 사라진다(진행 중인 노출을
// 새 결제가 지운다). 이미 잡힌 창이 있으면 **같은 등급으로 이어 사는 연장**만 받고 종료일을 늘린다.

/** 결제창에 실어 보내는 주문 — `customData`로 PortOne 결제 레코드에 남는다 */
export interface PromotionOrder {
  jobId: string;
  tier: ExposureProduct;
  weeks: ExposureWeeks;
  /** 시작 주 월요일(YYYY-MM-DD) */
  startsAt: string;
}

export type PromotionResult =
  | { ok: true; order: PromotionOrder; endsAt: string }
  | { ok: false; message: string; charged: boolean };

type Supabase = Awaited<ReturnType<typeof createClient>>;

const CONTACT_NEEDED = "결제는 확인됐지만 노출을 적용하지 못했어요. 결제번호로 문의해 주세요.";
const REFUNDED_INVALID = "주문 내용을 확인할 수 없어 결제를 전액 취소했어요. 다시 신청해 주세요.";
const REFUNDED_FULL =
  "그 주 자리가 방금 다 찼어요. 결제는 전액 취소했어요 — 다른 주나 기간으로 다시 신청해 주세요.";
const REFUNDED_WINDOW =
  "이 공고는 이미 노출이 잡혀 있어요. 결제는 전액 취소했어요 — 노출이 끝나는 다음 주부터 같은 등급으로 이어 신청할 수 있어요.";
const PAYMENT_ID_PREFIX = "promo-"; // 결제창이 만드는 번호 형식(promote-checkout) — 다른 형식은 우리 결제가 아니다
const KRW = "KRW";
const PAID = "PAID" satisfies PromotionStatus;
const CANCELLED = "CANCELLED" satisfies PromotionStatus;
const UNIQUE_VIOLATION = "23505";

export async function completePromotion(paymentId: string): Promise<PromotionResult> {
  if (!paymentId.startsWith(PAYMENT_ID_PREFIX)) {
    return { ok: false, message: "알 수 없는 결제번호예요.", charged: false };
  }

  const user = await requireUser();
  if (!hasChurchAccess(user)) {
    // 청구 여부를 모른다 — 인증이 풀린 상태로 결제창을 지났을 수 있어 재시도로 몰지 않는다
    return { ok: false, message: "교회 인증이 필요해요. 결제번호로 문의해 주세요.", charged: true };
  }

  const supabase = await createClient();
  const today = todayInSeoul();

  // 멱등 — 이미 적은 결제면 원장으로 답한다(모바일 복귀 새로고침·이중 호출). PortOne 왕복도 없다
  const recorded = await replayFromLedger(supabase, paymentId);
  if (recorded !== null) return recorded;

  // PortOne에 직접 묻는다 — 상태·금액·통화·주문 전부 여기서
  let payment;
  try {
    payment = await getPayment(paymentId);
  } catch (thrown) {
    console.error("[promote] 결제 조회 실패", paymentId, thrown);
    return { ok: false, message: CONTACT_NEEDED, charged: true };
  }
  if (payment === null) {
    return { ok: false, message: "결제 기록을 찾지 못했어요.", charged: false };
  }
  if (payment.status !== PAID) {
    return { ok: false, message: "결제가 완료되지 않았어요. 다시 시도해 주세요.", charged: false };
  }

  // 주문을 못 읽으면 원장에 적을 등급·기간이 없다 — 취소도 기록 없이 하게 되니 운영자 확인으로 넘긴다
  const order = parseOrder(payment.customData);
  if (order === null) {
    console.error("[promote] 주문 해석 실패", paymentId, payment.customData);
    return { ok: false, message: CONTACT_NEEDED, charged: true };
  }
  const period = promotionPeriod(order.startsAt, order.weeks);
  const ledgerRow = {
    job_id: order.jobId,
    tier: order.tier,
    weeks: order.weeks,
    amount: payment.amount.total,
    payment_id: paymentId,
    starts_at: period.startsAt,
    ends_at: period.endsAt,
  };
  const refund = (reason: string, message: string) =>
    cancelAndRecord(supabase, paymentId, reason, ledgerRow, message);

  // 화면이 낸 주문이 아니다 — 금액·통화가 다르거나, 시작 주가 화면의 선택지 밖이거나, 기간이 통째로 과거다
  const priced =
    payment.currency === KRW && payment.amount.total === exposurePrice(order.tier, order.weeks);
  if (!priced || !isAllowedStart(order.startsAt, today) || period.endsAt < today) {
    console.error("[promote] 주문 불일치", paymentId, order, payment.amount, payment.currency);
    return refund("주문 불일치", REFUNDED_INVALID);
  }

  // 이 교회의 공고인가 — 남의 공고에 광고를 걸 수 없다. 조회 실패(일시 장애)와 "내 공고 아님"(확정)은 갈라 답한다
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", order.jobId)
    .eq("church_id", user.churchId)
    .maybeSingle();
  if (jobError) {
    console.error("[promote] 대상 공고 조회 실패", paymentId, order.jobId, jobError);
    return { ok: false, message: CONTACT_NEEDED, charged: true };
  }
  if (!job) {
    console.error("[promote] 남의 공고", paymentId, order.jobId, user.churchId);
    return refund("교회의 공고가 아님", REFUNDED_INVALID);
  }

  // 정원·창 재확인 — 화면이 봤을 때와 결제창을 지나는 사이에 다른 결제가 들어올 수 있다(경합).
  // 이번 주 월요일부터 읽어야 이 공고의 **진행 중인 창**(기간 앞에서 끝나는 것)도 잡힌다.
  const paid = await getPaidPromotionsOverlapping({
    startsAt: mondayOf(today),
    endsAt: period.endsAt,
  });
  const window = pendingWindow(order.jobId, today, paid);
  const extension = window !== null && isExtension(window, order);
  if (window !== null && !extension) return refund("같은 공고의 노출과 겹침", REFUNDED_WINDOW);
  if (firstFullWeek(order.tier, period, weeklySales(weeksOf(period), paid)) !== null) {
    return refund("정원 마감", REFUNDED_FULL);
  }

  const inserted = await supabase
    .from("job_promotions")
    .insert({ ...ledgerRow, status: PAID })
    .select("created_at")
    .single();
  if (inserted.error) {
    // UNIQUE 위반 — 같은 결제가 먼저 적혔다(이중 호출). 원장이 답이고, 캐시 적용도 거기서 다시 한다
    if (inserted.error.code === UNIQUE_VIOLATION) {
      return (
        (await replayFromLedger(supabase, paymentId)) ?? {
          ok: false,
          message: CONTACT_NEEDED,
          charged: true,
        }
      );
    }
    console.error("[promote] 원장 기록 실패", paymentId, inserted.error);
    return { ok: false, message: CONTACT_NEEDED, charged: true };
  }

  // 세고-적기 사이에 다른 결제가 끼어들었나 — 적은 뒤 다시 읽어 **먼저 적힌 행**만으로 정원을 다시 센다.
  // DB가 배타를 강제하지 않으니(트리거·함수 없음) 이 한 번의 재확인이 초과 판매를 막는다. 졌으면 취소한다.
  const lost = lostCapacityRace(
    order.tier,
    period,
    { paymentId, createdAt: inserted.data.created_at },
    await getPaidPromotionsOverlapping(period),
  );
  if (lost !== null) return cancelRecorded(supabase, paymentId, "정원 마감(경합)", REFUNDED_FULL);

  const applied = await applyExposure(supabase, order.jobId, order.tier, period, extension);
  if (!applied) return { ok: false, message: CONTACT_NEEDED, charged: true };

  updateTag("jobs");
  return { ok: true, order, endsAt: period.endsAt };
}

/** 원장에 있는 결제로 답한다 — PAID면 캐시 적용을 한 번 더 하고(멱등) 성공, 취소·환불이면 그 사실. 없으면 null */
async function replayFromLedger(
  supabase: Supabase,
  paymentId: string,
): Promise<PromotionResult | null> {
  const { data: row, error } = await supabase
    .from("job_promotions")
    .select("job_id, tier, weeks, starts_at, ends_at, status")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (error) {
    console.error("[promote] 원장 조회 실패", paymentId, error);
    return { ok: false, message: CONTACT_NEEDED, charged: true };
  }
  if (!row) return null;
  if (row.status !== PAID) {
    return { ok: false, message: "취소된 결제예요. 다시 신청해 주세요.", charged: false };
  }
  if (!isExposureProduct(row.tier) || !isExposureWeeks(row.weeks)) {
    return { ok: false, message: CONTACT_NEEDED, charged: true };
  }
  const period = { startsAt: row.starts_at, endsAt: row.ends_at };
  // 먼저 적은 쪽이 캐시 적용 전에 죽었을 수 있다 — 적용은 멱등이라 여기서 다시 해도 안전하다
  const applied = await applyExposure(supabase, row.job_id, row.tier, period, null);
  if (!applied) return { ok: false, message: CONTACT_NEEDED, charged: true };
  updateTag("jobs");
  return {
    ok: true,
    order: { jobId: row.job_id, tier: row.tier, weeks: row.weeks, startsAt: row.starts_at },
    endsAt: row.ends_at,
  };
}

/**
 * 캐시 컬럼 적용 — "지금 이 공고는 스페셜이다"를 `now()` 없이 읽는 값(DATA §7). 원장과 함께 써야 한다.
 * `extension`이 true면 종료일만 늘린다(진행 중인 창의 시작을 건드리면 이번 주 노출이 사라진다). null이면 지금
 * 캐시를 읽어 판정한다 — 같은 등급의 창이 이 기간 바로 앞까지 이어져 있으면 연장이다(원장 재생 경로).
 * 트리거가 없다 — `updated_at`도 여기서 넣는다(공고 액션들과 같은 관용구).
 */
async function applyExposure(
  supabase: Supabase,
  jobId: string,
  tier: ExposureProduct,
  period: PromotionPeriod,
  extension: boolean | null,
): Promise<boolean> {
  let extend = extension;
  if (extend === null) {
    const { data } = await supabase
      .from("jobs")
      .select("featured_tier, featured_from, featured_until")
      .eq("id", jobId)
      .maybeSingle();
    const sameTier = data?.featured_tier === tier && data.featured_from !== null;
    // 이미 이 기간을 덮는 창이 있다(같은 결제의 재생) — 다시 쓰면 연장된 창의 시작이 뒤로 밀려 진행 중 노출이 끊긴다
    if (
      sameTier &&
      data.featured_from! <= period.startsAt &&
      data.featured_until !== null &&
      data.featured_until >= period.endsAt
    ) {
      return true;
    }
    // 연장 = 같은 등급의 창이 새 기간 바로 전날(일요일)에 끝난다
    extend = sameTier && data.featured_until === addDays(period.startsAt, -1);
  }
  const patch = extend
    ? { featured_until: period.endsAt }
    : { featured_tier: tier, featured_from: period.startsAt, featured_until: period.endsAt };
  const { error } = await supabase
    .from("jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) {
    // 원장은 적혔다(자리는 잡혔다) — 노출만 안 걸렸으니 운영자가 원장을 보고 다시 건다
    console.error("[promote] 노출 적용 실패", jobId, error);
    return false;
  }
  return true;
}

/** `customData` — SDK가 객체를 JSON 문자열로 저장한다. 모양이 다르면 null */
function parseOrder(customData: string | null): PromotionOrder | null {
  if (!customData) return null;
  try {
    const raw = JSON.parse(customData) as Record<string, unknown>;
    const { jobId, tier, weeks, startsAt } = raw;
    if (typeof jobId !== "string" || typeof startsAt !== "string") return null;
    if (!isExposureProduct(tier) || !isExposureWeeks(weeks)) return null;
    // 날짜는 모양부터 본다 — `mondayOf`는 못 읽는 값을 그대로 돌려줘 월요일 검사가 통과해 버린다
    if (!isIsoDate(startsAt) || mondayOf(startsAt) !== startsAt) return null;
    return { jobId, tier, weeks, startsAt };
  } catch {
    return null;
  }
}

type LedgerRow = {
  job_id: string;
  tier: ExposureProduct;
  weeks: ExposureWeeks;
  amount: number;
  payment_id: string;
  starts_at: string;
  ends_at: string;
};

/**
 * 자리를 줄 수 없어 되돌려준다 — PortOne 전액 취소 뒤 원장에 **CANCELLED로 적는다**(청구·환불 이력은 정산 대조와
 * 문의 응대의 근거다 · DATA §3 "append-only 원장"). 취소가 안 되면 청구된 상태로 남으니 문의로 넘긴다.
 */
async function cancelAndRecord(
  supabase: Supabase,
  paymentId: string,
  reason: string,
  row: LedgerRow,
  message: string,
): Promise<PromotionResult> {
  if (!(await cancelled(paymentId, reason))) return chargedButStuck(reason);
  const { error } = await supabase.from("job_promotions").insert({ ...row, status: CANCELLED });
  // UNIQUE 위반은 이미 적힌 것 — 취소 기록이 두 번 필요하진 않다
  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error("[promote] 취소 기록 실패", paymentId, error);
  }
  return { ok: false, message, charged: false };
}

/** 이미 PAID로 적힌 행을 되돌린다(경합에서 졌을 때) — 취소 뒤 상태만 바꾼다(append-only: 지우지 않는다) */
async function cancelRecorded(
  supabase: Supabase,
  paymentId: string,
  reason: string,
  message: string,
): Promise<PromotionResult> {
  if (!(await cancelled(paymentId, reason))) return chargedButStuck(reason);
  const { error } = await supabase
    .from("job_promotions")
    .update({ status: CANCELLED })
    .eq("payment_id", paymentId);
  if (error) {
    // 돈은 돌아갔는데 원장이 PAID로 남았다 — 자리를 하나 더 차지한 채다. 운영자가 원장에서 바로잡는다
    console.error("[promote] 취소 상태 기록 실패 — 원장 PAID 잔존", paymentId, error);
  }
  return { ok: false, message, charged: false };
}

/** PortOne 전액 취소 — 접수(REQUESTED)도 성공으로 본다(PG가 비동기로 마무리한다) */
async function cancelled(paymentId: string, reason: string): Promise<boolean> {
  try {
    const status = await cancelPayment(paymentId, reason);
    if (status === "SUCCEEDED" || status === "REQUESTED") return true;
    console.error("[promote] 취소 상태 확인 필요", paymentId, status);
  } catch (thrown) {
    console.error("[promote] 취소 실패", paymentId, thrown);
  }
  return false;
}

function chargedButStuck(reason: string): PromotionResult {
  return {
    ok: false,
    message: `${reason}으로 노출을 적용할 수 없는데 결제 취소가 확인되지 않았어요. 결제번호로 문의해 주세요.`,
    charged: true,
  };
}
