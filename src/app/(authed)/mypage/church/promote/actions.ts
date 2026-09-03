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
  firstFullDay,
  isAllowedStart,
  isIsoDate,
  lostCapacityRace,
  lostOverlapRace,
  overlapsExisting,
  promotionPeriod,
} from "@/lib/exposure-order";
import { todayInSeoul } from "@/lib/job-visibility";
import { cancelPayment, getPayment } from "@/lib/portone";
import { getPaidPromotionsOverlapping } from "@/lib/queries/promotions";
import { createClient } from "@/lib/supabase/server";

// 노출 결제 완료 — **원장에 한 줄 적는 것이 곧 노출이다.** 결제창(브라우저)이 끝나면 여기로 온다:
// PC는 SDK 약속이 풀리는 즉시, 모바일은 `redirectUrl`로 돌아온 화면이 URL의 `paymentId`로.
//
// Server Action인 이유(2026-09-02 확정): 적용 직후 `updateTag("jobs")`로 캐시를 비워 교회가 홈·목록에서
// 자기 광고를 **바로** 본다. route handler는 `revalidateTag`만 가능해 다음 방문자가 옛 목록을 본다.
// 그래서 `/api/payments/complete`는 없앴다(CLAUDE "REST 라우트 금지"의 예외 하나가 줄었다).
//
// **주문은 PortOne이 들고 있다.** 결제창에 실은 `customData`(공고·등급·주수·시작일)를 결제 조회로 다시 읽는다 —
// 클라이언트가 한 번 더 보낸 값을 믿지 않고, 모바일 복귀처럼 우리 쪽 상태가 사라진 뒤에도 같은 답이 나온다.
// 금액은 등급·주수로 **서버가 재계산**해 PortOne이 받은 금액·통화와 대조한다(위변조·다른 상품 결제 방어).
//
// ⚠️ 실연동 채널이라 여기 도달한 결제는 **카드가 이미 청구됐다.** 그래서 실패는 두 갈래로 갈라 답한다:
//  · `charged: false` — 청구가 없었거나 **우리가 전액 취소했다**(주문 불일치·자리 없음·경합). 다시 시도해도 안전하다.
//    취소한 결제는 원장에 CANCELLED로 남긴다 — 정산 대조·문의 응대가 원장 표(`/admin/promotions`)에서 끝나게.
//  · `charged: true`  — 청구됐는데 적용도 취소도 못 했다. 화면은 재시도 대신 결제번호와 문의 수단을 보여준다.
// 멱등성은 `job_promotions.payment_id UNIQUE`다 — 같은 결제가 두 번 들어와도 노출이 두 번 적립되지 않는다.
//
// **원장이 유일한 진실이다**(2026-09-03) — `jobs`에 노출 칸이 없다. 여기가 하는 쓰기는 원장 INSERT 하나뿐이고,
// 목록·홈·상세는 오늘을 덮는 PAID 행을 읽어 등급을 정한다. 그래서 "노출 적용"이라는 별도 단계가 없다.
// 같은 공고에 **기간이 겹치는 구매만** 막는다 — 같은 날 값을 두 번 받지 않고, 그날 어느 등급인지가 애매해지지 않는다.
// 정원과 겹침은 **팔기 전과 적은 뒤 두 번** 본다 — DB가 배타를 강제하지 않아(트리거·함수 없음) 세고-적기 사이에
// 다른 결제가 들어올 수 있다. 두 번째 판정은 순서 키로 하므로 어느 쪽에서 봐도 한 명만 진다.

/** 결제창에 실어 보내는 주문 — `customData`로 PortOne 결제 레코드에 남는다 */
export interface PromotionOrder {
  jobId: string;
  tier: ExposureProduct;
  weeks: ExposureWeeks;
  /** 시작일(YYYY-MM-DD) — 오늘부터 7일 안 */
  startsAt: string;
}

export type PromotionResult =
  | { ok: true; order: PromotionOrder; endsAt: string }
  | { ok: false; message: string; charged: boolean };

type Supabase = Awaited<ReturnType<typeof createClient>>;

const CONTACT_NEEDED = "결제는 확인됐지만 노출을 적용하지 못했어요. 결제번호로 문의해 주세요.";
const UNKNOWN_PAYMENT = "알 수 없는 결제번호예요.";
const REFUNDED_INVALID = "주문 내용을 확인할 수 없어 결제를 전액 취소했어요. 다시 신청해 주세요.";
const refundedFull = (day: string) =>
  `${monthDay(day)}에 자리가 방금 다 찼어요. 결제는 전액 취소했어요 — 다른 날짜나 기간으로 다시 신청해 주세요.`;
/** "2026-09-07" → "9/7" — 결제 화면과 같은 날짜 표기 */
const monthDay = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const REFUNDED_WINDOW =
  "이 공고에 이미 잡힌 노출과 기간이 겹쳐요. 결제는 전액 취소했어요. 노출이 끝난 뒤 다시 신청해 주세요.";
const PAYMENT_ID_PREFIX = "promo-"; // 결제창이 만드는 번호 형식(promote-checkout) — 다른 형식은 우리 결제가 아니다
const KRW = "KRW";
const PAID = "PAID" satisfies PromotionStatus;
const CANCELLED = "CANCELLED" satisfies PromotionStatus;
const UNIQUE_VIOLATION = "23505";
// **아무것도 안 써진 것이 확실한** 오류들 — CHECK·FK 위반은 행이 들어가지 않는다. 주문이 우리 규칙과
// 어긋난 것이므로 청구를 되돌린다(문의로 넘기면 돈만 받고 흔적이 로그뿐이다). 그 밖의 코드는 행이
// 들어갔을 수도 있어 운영자 확인으로 보낸다 — 재시도는 `replayFromLedger`가 원장으로 답한다.
const NOT_WRITTEN_CODES = new Set(["23514", "23503"]);
/** 이 시간 안에 적힌 행이면 캐시를 대신 비운다 — 그 뒤에는 이미 비워졌거나 `cacheLife`가 지나간다 */
const RECENT_WRITE_MS = 10 * 60 * 1000;

export async function completePromotion(paymentId: string): Promise<PromotionResult> {
  if (!paymentId.startsWith(PAYMENT_ID_PREFIX)) {
    return { ok: false, message: UNKNOWN_PAYMENT, charged: false };
  }

  const user = await requireUser();
  if (!hasChurchAccess(user)) {
    // 청구 여부를 모른다 — 인증이 풀린 상태로 결제창을 지났을 수 있어 재시도로 몰지 않는다
    return { ok: false, message: "교회 인증이 필요해요. 결제번호로 문의해 주세요.", charged: true };
  }

  const supabase = await createClient();
  const today = todayInSeoul();

  // 멱등 — 이미 적은 결제면 원장으로 답한다(모바일 복귀 새로고침·이중 호출). PortOne 왕복도 없다
  const recorded = await replayFromLedger(supabase, paymentId, user.churchId);
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

  // 화면이 낸 주문이 아니다 — 금액·통화가 다르거나, 시작일이 화면의 선택지(오늘부터 7일 + 자정 유예) 밖이다
  const priced =
    payment.currency === KRW && payment.amount.total === exposurePrice(order.tier, order.weeks);
  if (!priced || !isAllowedStart(order.startsAt, today)) {
    console.error("[promote] 주문 불일치", paymentId, order, payment.amount, payment.currency);
    return refund("주문 불일치", REFUNDED_INVALID);
  }

  // 이 교회의 공고인가 — 남의 공고에 광고를 걸 수 없다. 조회 실패(일시 장애)와 "내 공고 아님"(확정)은 갈라 답한다
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", order.jobId)
    .eq("church_id", user.churchId)
    // 결제 화면이 내주는 대상과 같은 술어 — 미claim 크롤 공고에는 광고를 걸 수 없다(`getChurchDashboard`)
    .eq("source", "CHURCH")
    .maybeSingle();
  if (jobError) {
    console.error("[promote] 대상 공고 조회 실패", paymentId, order.jobId, jobError);
    return { ok: false, message: CONTACT_NEEDED, charged: true };
  }
  if (!job) {
    console.error("[promote] 남의 공고", paymentId, order.jobId, user.churchId);
    return refund("교회의 공고가 아님", REFUNDED_INVALID);
  }

  // 정원·겹침 재확인 — 화면이 봤을 때와 결제창을 지나는 사이에 다른 결제가 들어올 수 있다(경합)
  const paid = await getPaidPromotionsOverlapping(period);
  if (overlapsExisting(order.jobId, period, paid)) {
    return refund("같은 공고의 노출과 기간 겹침", REFUNDED_WINDOW);
  }
  const fullDay = firstFullDay(order.tier, period, paid);
  if (fullDay !== null) return refund("정원 마감", refundedFull(fullDay));

  const inserted = await supabase
    .from("job_promotions")
    .insert({ ...ledgerRow, status: PAID })
    .select("created_at")
    .single();
  if (inserted.error) {
    // UNIQUE 위반 — 같은 결제가 먼저 적혔다(이중 호출). 원장이 답이고, 캐시 적용도 거기서 다시 한다
    if (inserted.error.code === UNIQUE_VIOLATION) {
      return (
        (await replayFromLedger(supabase, paymentId, user.churchId)) ?? {
          ok: false,
          message: CONTACT_NEEDED,
          charged: true,
        }
      );
    }
    console.error("[promote] 원장 기록 실패", paymentId, inserted.error);
    if (NOT_WRITTEN_CODES.has(inserted.error.code)) {
      return refund("원장 제약 위반", REFUNDED_INVALID);
    }
    return { ok: false, message: CONTACT_NEEDED, charged: true };
  }

  // 세고-적기 사이에 다른 결제가 끼어들었나 — 적은 뒤 다시 읽어 **먼저 적힌 행**만으로 둘 다 다시 본다.
  // DB가 배타를 강제하지 않으니(트리거·함수 없음) 이 한 번의 재확인이 초과 판매와 이중 청구를 막는다.
  const ours = { paymentId, createdAt: inserted.data.created_at };
  const after = await getPaidPromotionsOverlapping(period);
  // ① 같은 공고에 기간이 겹치는 결제가 먼저 적혔다(탭 두 개) — 정원 없는 기본 등급은 이것이 유일한 방어다
  if (lostOverlapRace(order.jobId, period, ours, after)) {
    return cancelRecorded(supabase, paymentId, "같은 공고의 노출과 기간 겹침", REFUNDED_WINDOW);
  }
  // ② 우리보다 먼저 적힌 같은 등급 행이 정원을 채웠다
  const lost = lostCapacityRace(order.tier, period, ours, after);
  if (lost !== null)
    return cancelRecorded(supabase, paymentId, "정원 마감(경합)", refundedFull(lost));

  // 원장 한 줄이 곧 노출이다 — 캐시를 비우면 다음 요청부터 목록·홈·상세가 이 등급을 읽는다
  updateTag("jobs");
  return { ok: true, order, endsAt: period.endsAt };
}

/**
 * 원장에 있는 결제로 답한다 — PAID면 캐시 적용을 한 번 더 하고(멱등) 성공, 취소·환불이면 그 사실. 없으면 null.
 * ⚠️ **남의 결제번호면 없는 것처럼 답하지 않는다** — null을 주면 아래 흐름이 그 결제를 PortOne에서 조회하고
 *    끝내 **다른 교회의 결제를 취소**하게 된다. 주문 내용도 새지 않게 그 자리에서 끊는다(RLS 유예 · DATA §9).
 */
async function replayFromLedger(
  supabase: Supabase,
  paymentId: string,
  churchId: string,
): Promise<PromotionResult | null> {
  const { data: row, error } = await supabase
    .from("job_promotions")
    .select("job_id, tier, weeks, starts_at, ends_at, status, created_at, jobs(church_id)")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (error) {
    console.error("[promote] 원장 조회 실패", paymentId, error);
    return { ok: false, message: CONTACT_NEEDED, charged: true };
  }
  if (!row) return null;
  if (row.jobs?.church_id !== churchId) {
    console.error("[promote] 남의 결제번호", paymentId, churchId);
    return { ok: false, message: UNKNOWN_PAYMENT, charged: false };
  }
  if (row.status !== PAID) {
    return { ok: false, message: "취소된 결제예요. 다시 신청해 주세요.", charged: false };
  }
  if (!isExposureProduct(row.tier) || !isExposureWeeks(row.weeks)) {
    return { ok: false, message: CONTACT_NEEDED, charged: true };
  }
  // 먼저 적은 쪽이 캐시를 비우기 전에 죽었을 수 있다 — 그때만 대신 비운다. 무조건 비우면 이 화면을
  // 새로고침하는 것만으로 공개 캐시 전체(`cacheTag("jobs")`)를 계속 날릴 수 있다.
  if (Date.now() - Date.parse(row.created_at) < RECENT_WRITE_MS) updateTag("jobs");
  return {
    ok: true,
    order: { jobId: row.job_id, tier: row.tier, weeks: row.weeks, startsAt: row.starts_at },
    endsAt: row.ends_at,
  };
}

/** `customData` — SDK가 객체를 JSON 문자열로 저장한다. 모양이 다르면 null */
function parseOrder(customData: string | null): PromotionOrder | null {
  if (!customData) return null;
  try {
    const raw = JSON.parse(customData) as Record<string, unknown>;
    const { jobId, tier, weeks, startsAt } = raw;
    if (typeof jobId !== "string" || typeof startsAt !== "string") return null;
    if (!isExposureProduct(tier) || !isExposureWeeks(weeks)) return null;
    // 날짜는 모양부터 본다 — 못 읽는 값이 통과하면 INSERT가 Postgres 캐스트에서 죽는다
    if (!isIsoDate(startsAt)) return null;
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

/**
 * 이미 PAID로 적힌 행을 되돌린다(경합에서 졌을 때) — 취소 뒤 상태만 바꾼다(append-only: 지우지 않는다).
 * ⚠️ **PAID 행이 곧 노출이다** — 상태를 바꾸기 전까지 그 광고는 실제로 나가고 있다. 그래서 바꾼 뒤
 *    `updateTag("jobs")`로 캐시를 비운다(INSERT와 UPDATE 사이에 캐시가 채워졌으면 환불된 광고가
 *    한 시간 더 걸린다). 취소가 확인되지 않으면 **노출은 켜진 채**라 문구도 그렇게 말한다.
 */
async function cancelRecorded(
  supabase: Supabase,
  paymentId: string,
  reason: string,
  message: string,
): Promise<PromotionResult> {
  if (!(await cancelled(paymentId, reason))) {
    return {
      ok: false,
      message: `${reason}이지만 결제 취소가 확인되지 않았어요. 노출은 켜진 상태로 두었으니 결제번호로 문의해 주세요.`,
      charged: true,
    };
  }
  const { error } = await supabase
    .from("job_promotions")
    .update({ status: CANCELLED })
    .eq("payment_id", paymentId);
  if (error) {
    // 돈은 돌아갔는데 원장이 PAID로 남았다 — 자리를 하나 더 차지한 채다. 운영자가 원장에서 바로잡는다
    console.error("[promote] 취소 상태 기록 실패 — 원장 PAID 잔존", paymentId, error);
  }
  updateTag("jobs");
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
