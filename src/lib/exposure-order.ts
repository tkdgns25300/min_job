import { EXPOSURE_PRODUCTS, type ExposureProduct, type ExposureWeeks } from "@/constants/domain";
import { addDays } from "@/lib/job-visibility";

// 노출 주문의 순수 판정 — 주 경계·기간·정원·겹침·경합. DB도 결제도 모른다(seam·Server Action이 값을 넘긴다).
// 돈이 걸린 판정이라 전부 단위 테스트가 있다(`exposure-order.test.ts`).
//
// **주는 월~일이고 상품은 월요일에 시작한다**(DB CHECK `job_promotions_starts_monday_check`). 시작 주는
// **이번 주·다음 주 둘뿐** — 이번 주는 오늘부터 남은 요일만 노출되고, 다음 주는 월요일부터 온전히 노출된다.
// 정원(`weeklyCapacity`)은 **겹치는 주마다** 센다 — 4주 상품은 네 주 모두 자리가 있어야 팔린다.
// 한 공고는 **창 하나**만 가진다(캐시 컬럼 `featured_*`가 한 창이다) — 이미 잡힌 창이 끝나는 다음 주부터 같은
// 등급으로 이어 사는 것(연장)만 허용한다.

/** 정원 판정에 필요한 원장 행 조각 — `job_promotions`의 PAID 행만 넘긴다(취소·환불은 자리를 차지하지 않는다) */
export interface PromotionSpan {
  jobId: string;
  tier: ExposureProduct;
  startsAt: string;
  endsAt: string;
  /** 경합 판정의 순서 키 — 먼저 적힌 행이 이긴다(`created_at`, 같으면 `payment_id`) */
  paymentId: string;
  createdAt: string;
}

export interface PromotionPeriod {
  startsAt: string;
  endsAt: string;
}

/** 한 주에 등급별로 팔린 자리 — 화면에 넘기는 형태(누가 샀는지는 싣지 않는다) */
export interface WeekSales {
  monday: string;
  sold: Record<ExposureProduct, number>;
}

/** 공고에 이미 잡힌 창(노출 중 또는 예약) — 끝나는 날과 등급만 있으면 연장 판정이 된다 */
export interface PendingWindow {
  tier: ExposureProduct;
  endsAt: string;
}

const DAYS_PER_WEEK = 7;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIERS = Object.keys(EXPOSURE_PRODUCTS) as ExposureProduct[];

/** "YYYY-MM-DD"이고 실제 날짜인가 — 결제 레코드에서 읽은 주문은 신뢰 경계 밖이라 모양부터 본다 */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** 월요일 기준 요일 오프셋(월 0 … 일 6). 정오 UTC 계산이라 로컬 TZ와 무관하다(`addDays`와 같은 관용구) */
function weekdayFromMonday(isoDate: string): number | null {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getUTCDay() + 6) % DAYS_PER_WEEK;
}

/** 그 날짜가 든 주의 월요일 */
export function mondayOf(isoDate: string): string {
  const offset = weekdayFromMonday(isoDate);
  return offset === null ? isoDate : addDays(isoDate, -offset);
}

/** 살 수 있는 시작 주 — 이번 주 월요일과 다음 주 월요일 */
export function startWeekOptions(today: string): [string, string] {
  const thisMonday = mondayOf(today);
  return [thisMonday, addDays(thisMonday, DAYS_PER_WEEK)];
}

/**
 * 결제 완료 시점의 시작 주 허용 — 화면의 두 선택지에 **지난주 월요일**을 더한다: 일요일 밤에 결제하고
 * 월요일 새벽에 돌아온 복귀를 막으면 안 된다. 그보다 먼 주는 화면이 낸 주문이 아니다(정원을 미리 잠그는 조작).
 */
export function isAllowedStart(startsAt: string, today: string): boolean {
  const [thisMonday, nextMonday] = startWeekOptions(today);
  return (
    startsAt === addDays(thisMonday, -DAYS_PER_WEEK) ||
    startsAt === thisMonday ||
    startsAt === nextMonday
  );
}

/** 기간 — 종료일은 마지막 주 일요일(DB CHECK `ends_at = starts_at + weeks*7 - 1`과 같은 식) */
export function promotionPeriod(startsAt: string, weeks: ExposureWeeks): PromotionPeriod {
  return { startsAt, endsAt: addDays(startsAt, weeks * DAYS_PER_WEEK - 1) };
}

/** 기간에 든 주들의 월요일 */
export function weeksOf(period: PromotionPeriod): string[] {
  const mondays: string[] = [];
  for (let m = mondayOf(period.startsAt); m <= period.endsAt; m = addDays(m, DAYS_PER_WEEK)) {
    mondays.push(m);
  }
  return mondays;
}

/** 이번 주 시작이면 오늘부터 남은 날 수(오늘 포함) — 화면이 "오늘부터 N일"로 알린다 */
export function daysLeftInWeek(today: string): number {
  const offset = weekdayFromMonday(today);
  return offset === null ? DAYS_PER_WEEK : DAYS_PER_WEEK - offset;
}

const overlaps = (a: PromotionPeriod, b: PromotionPeriod) =>
  a.startsAt <= b.endsAt && b.startsAt <= a.endsAt;

/** 그 주(월요일 기준)에 이 등급이 몇 건 팔렸나 */
export function soldInWeek(
  tier: ExposureProduct,
  monday: string,
  paid: readonly PromotionSpan[],
): number {
  const week = promotionPeriod(monday, 1);
  return paid.filter((p) => p.tier === tier && overlaps(p, week)).length;
}

/** 주마다 등급별 팔린 자리 — 화면에 넘기는 요약(원장 행 자체는 넘기지 않는다: 남의 예약이 새지 않게) */
export function weeklySales(
  mondays: readonly string[],
  paid: readonly PromotionSpan[],
): WeekSales[] {
  return mondays.map((monday) => ({
    monday,
    sold: Object.fromEntries(TIERS.map((tier) => [tier, soldInWeek(tier, monday, paid)])) as Record<
      ExposureProduct,
      number
    >,
  }));
}

/**
 * 기간 전체에 자리가 있나 — 첫 번째로 찬 주의 월요일을 돌려준다(없으면 null).
 * 4주 상품은 넷째 주가 찼어도 못 판다: 겹치는 주 하나라도 정원을 넘기면 먼저 산 교회의 자리가 묽어진다.
 * 정원 없는 등급(기본)은 늘 null. 요약에 없는 주는 0으로 본다.
 */
export function firstFullWeek(
  tier: ExposureProduct,
  period: PromotionPeriod,
  sales: readonly WeekSales[],
): string | null {
  const capacity = EXPOSURE_PRODUCTS[tier].weeklyCapacity;
  if (capacity === null) return null;
  for (const monday of weeksOf(period)) {
    const sold = sales.find((w) => w.monday === monday)?.sold[tier] ?? 0;
    if (sold >= capacity) return monday;
  }
  return null;
}

/**
 * 이 공고에 이미 잡힌 창 — 오늘 이후로 끝나는 PAID 행 중 가장 늦게 끝나는 것. 없으면 null.
 * 캐시 컬럼이 창 하나만 담으므로 두 창을 겹쳐 두면 하나가 사라진다 — 그래서 창이 있으면 **연장만** 된다.
 */
export function pendingWindow(
  jobId: string,
  today: string,
  paid: readonly PromotionSpan[],
): PendingWindow | null {
  const mine = paid.filter((p) => p.jobId === jobId && p.endsAt >= today);
  if (mine.length === 0) return null;
  const last = mine.reduce((a, b) => (b.endsAt > a.endsAt ? b : a));
  return { tier: last.tier, endsAt: last.endsAt };
}

/** 연장인가 — 같은 등급으로, 잡힌 창이 끝나는 바로 다음 월요일부터 */
export function isExtension(
  window: PendingWindow,
  order: { tier: ExposureProduct; startsAt: string },
): boolean {
  return order.tier === window.tier && order.startsAt === addDays(window.endsAt, 1);
}

/**
 * 경합에서 졌나 — 원장에 적은 **뒤** 다시 읽어, 기간의 어느 주에서든 우리보다 먼저 적힌 같은 등급 행이
 * 정원을 채웠으면 그 월요일. DB가 배타를 강제하지 않아(트리거·함수 없음) 세고-적기 사이에 둘이 들어올 수 있는데,
 * 순서 키(`created_at`, 같으면 `payment_id`)로 판정하면 어느 쪽에서 봐도 한 명만 진다.
 */
export function lostCapacityRace(
  tier: ExposureProduct,
  period: PromotionPeriod,
  ours: Pick<PromotionSpan, "paymentId" | "createdAt">,
  paid: readonly PromotionSpan[],
): string | null {
  const capacity = EXPOSURE_PRODUCTS[tier].weeklyCapacity;
  if (capacity === null) return null;
  const before = (p: PromotionSpan) =>
    p.paymentId !== ours.paymentId &&
    (p.createdAt < ours.createdAt ||
      (p.createdAt === ours.createdAt && p.paymentId < ours.paymentId));
  for (const monday of weeksOf(period)) {
    const week = promotionPeriod(monday, 1);
    const earlier = paid.filter((p) => p.tier === tier && overlaps(p, week) && before(p)).length;
    if (earlier >= capacity) return monday;
  }
  return null;
}
