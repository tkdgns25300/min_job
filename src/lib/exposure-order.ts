import {
  EXPOSURE_PRODUCTS,
  START_WINDOW_DAYS,
  type ExposureProduct,
  type ExposureWeeks,
} from "@/constants/domain";
import { addDays } from "@/lib/job-visibility";

// 노출 주문·노출 상태의 순수 판정 — 기간·정원·겹침·경합, 그리고 "이 공고가 지금 어떤 등급인가".
// DB도 결제도 모른다(seam·Server Action이 원장 행을 넘긴다). 돈이 걸린 판정이라 전부 단위 테스트가 있다.
//
// **원장이 유일한 진실이다**(2026-09-03 개정). `jobs`에는 노출 칸이 없다 — 공고의 지금 등급은 `job_promotions`의
// PAID 행 중 오늘을 덮는 것에서 나온다. 그전에는 결제가 `jobs.featured_*`에 답을 미리 써 뒀는데, 같은 사실이 두
// 곳에 있어 "한 공고는 창 하나"라는 제약과 동기화 걱정이 따라왔다.
//
// **기간은 시작일부터 7일씩**이다(개정 2026-09-03 — 그전에는 월~일 고정이라 목요일에 사면 4일에 1주 값이었다).
// 시작일은 오늘부터 7일 안에서 고른다. 정원은 **어느 날이든 동시에 N건**이다 — 새 기간의 하루하루를 보고 그날을
// 덮는 같은 등급 행이 정원 미만이어야 판다. 홈 추천이 3칸이라 "동시에 3건"이 자리 수와 그대로 맞는다.

/** 정원 판정에 필요한 최소 조각 — 화면에도 이 모양만 내려간다(누가 샀는지는 싣지 않는다) */
export interface CapacitySpan {
  tier: ExposureProduct;
  startsAt: string;
  endsAt: string;
}

/** 서버가 다루는 원장 행 — 정원 조각 + 소유·순서 키 */
export interface PromotionSpan extends CapacitySpan {
  jobId: string;
  /** 경합 판정의 순서 키 — 먼저 적힌 행이 이긴다(`created_at`, 같으면 `payment_id`) */
  paymentId: string;
  createdAt: string;
}

export interface PromotionPeriod {
  startsAt: string;
  endsAt: string;
}

/** 공고의 지금 노출 — 오늘을 덮으면 `active`, 아직 시작 전이면 예약이다 */
export interface ExposureWindow {
  tier: ExposureProduct;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

const DAYS_PER_WEEK = 7;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 사다리 위부터 — 겹친 창이 있으면 높은 등급이 이긴다(`EXPOSURE_PRODUCTS` 키 순서가 정본) */
const TIER_ORDER = Object.keys(EXPOSURE_PRODUCTS) as ExposureProduct[];

/** "YYYY-MM-DD"이고 실제 날짜인가 — 결제 레코드에서 읽은 주문은 신뢰 경계 밖이라 모양부터 본다 */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** 고를 수 있는 시작일 — 오늘부터 7일 */
export function startDateOptions(today: string): string[] {
  return Array.from({ length: START_WINDOW_DAYS }, (_, i) => addDays(today, i));
}

/**
 * 결제 완료 시점의 시작일 허용 — 화면의 선택지에 **어제**를 더한다. 자정 직전에 결제창을 띄우고 자정 뒤에
 * 돌아온 복귀를 막으면 안 된다. 그보다 먼 날은 화면이 낸 주문이 아니다(정원을 미리 잠그는 조작).
 */
export function isAllowedStart(startsAt: string, today: string): boolean {
  return startsAt >= addDays(today, -1) && startsAt <= addDays(today, START_WINDOW_DAYS - 1);
}

/** 기간 — 시작일부터 주수 × 7일(DB CHECK `ends_at = starts_at + weeks*7 - 1`과 같은 식) */
export function promotionPeriod(startsAt: string, weeks: ExposureWeeks): PromotionPeriod {
  return { startsAt, endsAt: addDays(startsAt, weeks * DAYS_PER_WEEK - 1) };
}

/** 기간에 든 날짜들 — 정원은 하루 단위로 센다(최대 28일) */
export function daysOf(period: PromotionPeriod): string[] {
  const days: string[] = [];
  for (let d = period.startsAt; d <= period.endsAt; d = addDays(d, 1)) days.push(d);
  return days;
}

const covers = (span: CapacitySpan, day: string) => span.startsAt <= day && day <= span.endsAt;
const overlaps = (a: PromotionPeriod, b: PromotionPeriod) =>
  a.startsAt <= b.endsAt && b.startsAt <= a.endsAt;

/** 그날 이 등급이 몇 건 노출되나 */
export function soldOn(tier: ExposureProduct, day: string, spans: readonly CapacitySpan[]): number {
  return spans.filter((s) => s.tier === tier && covers(s, day)).length;
}

/**
 * 기간 전체에 자리가 있나 — 처음으로 찬 날을 돌려준다(없으면 null).
 * 4주 상품은 마지막 날 하나가 차 있어도 못 판다: 하루라도 정원을 넘기면 먼저 산 교회의 자리가 묽어진다.
 * 정원 없는 등급(기본)은 늘 null.
 */
export function firstFullDay(
  tier: ExposureProduct,
  period: PromotionPeriod,
  spans: readonly CapacitySpan[],
): string | null {
  const capacity = EXPOSURE_PRODUCTS[tier].capacity;
  if (capacity === null) return null;
  return daysOf(period).find((day) => soldOn(tier, day, spans) >= capacity) ?? null;
}

/**
 * 이 기간과 겹치는 첫 구매 — 없으면 null. 겹치면 판매를 막는다: 같은 날에 두 번 값을 받지 않고,
 * "그날 이 공고는 어느 등급인가"가 애매해지지 않는다. 끝난 뒤 다시 사는 것은 언제든 된다.
 * **화면과 액션이 같은 함수를 쓴다** — 화면은 이 값으로 안내 문구를 만들고, 액션은 있으면 취소·환불한다.
 */
export function findClash(
  periods: readonly PromotionPeriod[],
  period: PromotionPeriod,
): PromotionPeriod | null {
  return periods.find((p) => overlaps(p, period)) ?? null;
}

/** 이 공고에 겹치는 구매가 있나 — 서버가 원장 행에서 바로 묻는다 */
export function overlapsExisting(
  jobId: string,
  period: PromotionPeriod,
  spans: readonly PromotionSpan[],
): boolean {
  return (
    findClash(
      spans.filter((s) => s.jobId === jobId),
      period,
    ) !== null
  );
}

/** 공고별로 남은 구매 기간 묶음 — 결제 화면이 "이 공고에 이미 잡힌 기간"으로 쓴다 */
export function periodsByJob(
  spans: readonly PromotionSpan[],
  jobIds: readonly string[],
): Record<string, PromotionPeriod[]> {
  const wanted = new Set(jobIds);
  const byJob: Record<string, PromotionPeriod[]> = {};
  for (const span of spans) {
    if (!wanted.has(span.jobId)) continue;
    (byJob[span.jobId] ??= []).push({ startsAt: span.startsAt, endsAt: span.endsAt });
  }
  return byJob;
}

/**
 * 공고별 **남은 노출 창** — 시작일순. 지난 구매는 애초에 넘어오지 않는다(`ends_at >= today`).
 * 한 공고가 겹치지 않는 창을 여럿 가질 수 있어(끝난 뒤 다시 사기) 교회 화면은 이 목록을 그대로 그린다.
 */
export function windowsByJob(
  spans: readonly PromotionSpan[],
  today: string,
): Map<string, ExposureWindow[]> {
  const byJob = new Map<string, ExposureWindow[]>();
  for (const span of spans) {
    if (span.endsAt < today) continue;
    const list = byJob.get(span.jobId) ?? [];
    list.push({
      tier: span.tier,
      startsAt: span.startsAt,
      endsAt: span.endsAt,
      active: covers(span, today),
    });
    byJob.set(span.jobId, list);
  }
  for (const list of byJob.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return byJob;
}

/**
 * 공고별 **지금 보여줄 창 하나** — 오늘을 덮는 것이 있으면 그것(겹치면 높은 등급), 없으면 가장 이른 예약.
 * 목록·홈·상세·운영자 표가 전부 이 한 함수의 답을 쓴다.
 */
export function exposureByJob(
  spans: readonly PromotionSpan[],
  today: string,
): Map<string, ExposureWindow> {
  const rank = (tier: ExposureProduct) => TIER_ORDER.indexOf(tier);
  const best = new Map<string, ExposureWindow>();
  for (const [jobId, windows] of windowsByJob(spans, today)) {
    // 시작일순이라 예약끼리는 먼저 오는 것이 이긴다 — 노출 중과 등급만 견준다
    const pick = windows.reduce((a, b) =>
      a.active !== b.active ? (a.active ? a : b) : a.active && rank(b.tier) < rank(a.tier) ? b : a,
    );
    best.set(jobId, pick);
  }
  return best;
}

/** 이 행이 우리보다 **먼저 적혔나** — 순서 키는 `created_at`, 같으면 `payment_id`. 경합 판정의 공통 술어 */
const writtenBefore = (s: PromotionSpan, ours: Ours) =>
  s.paymentId !== ours.paymentId &&
  (s.createdAt < ours.createdAt ||
    (s.createdAt === ours.createdAt && s.paymentId < ours.paymentId));

/** 경합 판정에서 "우리"를 가리키는 최소 조각 — 원장에 적힌 뒤에야 알 수 있는 두 값 */
type Ours = Pick<PromotionSpan, "paymentId" | "createdAt">;

/**
 * 경합에서 졌나 — 원장에 적은 **뒤** 다시 읽어, 기간의 어느 날에서든 우리보다 먼저 적힌 같은 등급 행이
 * 정원을 채웠으면 그날. DB가 배타를 강제하지 않아(트리거·함수 없음) 세고-적기 사이에 둘이 들어올 수 있는데,
 * 순서 키로 판정하면 어느 쪽에서 봐도 한 명만 진다.
 */
export function lostCapacityRace(
  tier: ExposureProduct,
  period: PromotionPeriod,
  ours: Ours,
  spans: readonly PromotionSpan[],
): string | null {
  const capacity = EXPOSURE_PRODUCTS[tier].capacity;
  if (capacity === null) return null;
  return (
    daysOf(period).find(
      (day) =>
        spans.filter((s) => s.tier === tier && covers(s, day) && writtenBefore(s, ours)).length >=
        capacity,
    ) ?? null
  );
}

/**
 * 겹침 경합에서 졌나 — 정원과 **같은 이유로 적은 뒤 다시 본다**. 파는 시점의 `overlapsExisting`은
 * 세고-적기 사이에 들어온 같은 공고의 다른 결제를 볼 수 없어(탭 두 개·이중 결제창), 둘 다 통과해
 * **한 공고에 겹치는 기간이 두 줄** 남는다 — 같은 날 값을 두 번 받은 것이다. 정원이 없는 기본 등급은
 * `lostCapacityRace`가 늘 `null`이라 이 판정이 유일한 방어다. 먼저 적힌 쪽이 이긴다.
 */
export function lostOverlapRace(
  jobId: string,
  period: PromotionPeriod,
  ours: Ours,
  spans: readonly PromotionSpan[],
): boolean {
  return spans.some((s) => s.jobId === jobId && writtenBefore(s, ours) && overlaps(s, period));
}
