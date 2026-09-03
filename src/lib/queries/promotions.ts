import { cacheLife, cacheTag } from "next/cache";
import {
  PROMOTION_STATUSES,
  isExposureProduct,
  isExposureWeeks,
  type ExposureProduct,
  type ExposureWeeks,
  type PromotionStatus,
} from "@/constants/domain";
import { keyOf } from "@/lib/domain-enum";
import {
  exposureByJob,
  type ExposureWindow,
  type PromotionPeriod,
  type PromotionSpan,
} from "@/lib/exposure-order";
import { todayInSeoul } from "@/lib/job-visibility";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllRows } from "./fetch-all";

// 데이터 소스 seam (노출 구매 원장 `job_promotions`) — **노출 상태의 유일한 출처**다(2026-09-03).
// `jobs`에는 노출 칸이 없다: 공고가 지금 어떤 등급인지는 오늘을 덮는 PAID 행이 답한다(판정은 `lib/exposure-order`).
//
// 이 파일만 캐시 규칙이 **둘로 갈린다**:
//  · **표시용 읽기**(`getActiveExposure`)는 `'use cache'` + `cacheTag("jobs")` + `cacheLife("hours")`. 공개 목록과
//    **같은 태그·같은 수명**이라 둘이 같이 늙고 결제 완료 액션의 `updateTag("jobs")`가 한 번에 비운다 — 카드와
//    노출이 서로 다른 시점의 답을 들고 어긋나지 않는다. 만료는 cached scope 안에서 만든 `todayInSeoul()`이
//    가른다(공고 만료와 같은 경로 · CLAUDE.md 제약 #2).
//  · **판매 판정**(`getPaidPromotionsOverlapping`)은 **캐시 금지**. 정원은 결제가 들어오는 순간 바뀌고, 캐시된
//    답으로 자리를 팔면 초과 판매다. 인증 화면·Server Action 뒤에서만 부르므로 `server.ts`(쿠키 세션)로 읽는다.
//
// ⚠️ **정원 판정은 모든 교회의 행을 봐야 한다.** RLS를 켤 때(DATA §9) `job_promotions` SELECT를 "본인 교회만"으로
//    두면 이 조회가 자기 행만 세어 **조용히 초과 판매**한다 — 그날 그 함수도 `service.ts`로 옮기거나(비PII: 등급·
//    기간·공고 id) 정책이 PAID 행의 그 칸들을 전원에게 열어야 한다. 화면엔 기간 조각(`CapacitySpan`)만 내려간다.
// 원장에 **쓰는 곳은 결제 액션 하나**다(`mypage/church/promote/actions.ts`) — 여기는 읽기만.

/** 자리를 차지하는 상태 — 정원·경합 판정은 이것만 센다(취소·환불은 자리가 아니다) */
const PAID = "PAID" satisfies PromotionStatus;

interface SpanRow {
  job_id: string;
  tier: string;
  starts_at: string;
  ends_at: string;
  payment_id: string;
  created_at: string;
}

/** 원장 행 → 판정 조각. `tier`는 `text + CHECK`라 string으로 온다 — 모르는 값은 버린다(자리를 안 차지하는 쪽) */
function toSpans(rows: SpanRow[]): PromotionSpan[] {
  return rows.flatMap((row) =>
    isExposureProduct(row.tier)
      ? [
          {
            jobId: row.job_id,
            tier: row.tier,
            startsAt: row.starts_at,
            endsAt: row.ends_at,
            paymentId: row.payment_id,
            createdAt: row.created_at,
          },
        ]
      : [],
  );
}

const SPAN_COLUMNS = "job_id, tier, starts_at, ends_at, payment_id, created_at";

/**
 * 공고별 지금 노출 — 오늘 이후로 끝나는 PAID 행만 읽어 `exposureByJob`이 정리한다.
 * 목록·홈·상세·운영자 표가 이 지도로 등급을 채운다(시작 전 예약은 `active=false`).
 *
 * 결제 건수만큼이라 보통은 아주 작다 — 전 공고를 훑는 카드 조회에 한 번 더 얹어도 무해하다.
 * ⚠️ 그래도 **표 전체를 훑는 조회라 `fetchAllRows`로 감싼다** — 기본 등급은 정원이 없어 동시 건수에
 *    상한이 없다. 1,000행을 넘기면 PostgREST가 조용히 자르고, 산 광고가 그냥 안 나온다(CLAUDE seam 규칙).
 */
export async function getActiveExposure(): Promise<Map<string, ExposureWindow>> {
  "use cache";
  cacheTag("jobs");
  cacheLife("hours");
  const today = todayInSeoul();
  const supabase = createServiceClient();
  const rows = await fetchAllRows<SpanRow>("노출 상태", (from, to) =>
    supabase
      .from("job_promotions")
      .select(SPAN_COLUMNS, { count: "exact" })
      .eq("status", PAID)
      .gte("ends_at", today)
      .order("id")
      .range(from, to),
  );
  return exposureByJob(toSpans(rows), today);
}

/**
 * 이 공고들의 남은 구매(PAID · 오늘 이후 종료) — 교회 대시보드가 자기 공고의 노출·예약을 그리는 데 쓴다.
 * 인증 뒤 조회이고 결제 직후 바로 보여야 하므로 캐시하지 않는다(`server.ts`).
 */
export async function getPromotionsForJobs(
  jobIds: string[],
  today: string,
): Promise<PromotionSpan[]> {
  if (jobIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_promotions")
    .select(SPAN_COLUMNS)
    .eq("status", PAID)
    .in("job_id", jobIds)
    .gte("ends_at", today);
  if (error) throw new Error(`노출 상태 조회 실패: ${error.message}`);
  return toSpans(data);
}

/**
 * 기간과 겹치는 **유효(PAID) 구매** — 정원·겹침·경합 판정의 입력(`lib/exposure-order`).
 * 취소·환불(CANCELLED·REFUNDED)은 자리를 차지하지 않으므로 처음부터 뺀다.
 */
export async function getPaidPromotionsOverlapping(
  period: PromotionPeriod,
): Promise<PromotionSpan[]> {
  const supabase = await createClient();
  // 정원을 세는 입력이라 **잘리면 초과 판매**다 — 한 장을 넘길 일이 드물어도 `fetchAllRows`로 감싼다
  const rows = await fetchAllRows<SpanRow>("노출 구매", (from, to) =>
    supabase
      .from("job_promotions")
      .select(SPAN_COLUMNS, { count: "exact" })
      .eq("status", PAID)
      .lte("starts_at", period.endsAt)
      .gte("ends_at", period.startsAt)
      .order("id")
      .range(from, to),
  );
  return toSpans(rows);
}

/** 운영자 원장 표 한 줄 — 공고 제목·교회명은 `jobs`에서 조인해 붙인다(원장엔 id만 있다) */
export interface PromotionLedgerRow {
  paymentId: string;
  jobId: string;
  jobTitle: string;
  churchName: string;
  tier: ExposureProduct;
  weeks: ExposureWeeks;
  startsAt: string;
  endsAt: string;
  amount: number;
  status: PromotionStatus;
  createdAt: string;
}

// 운영자 표 상한 — 정산 대조·문의 응대는 최근 것이면 충분하다(월 정산 4회 · 상품 최대 4주)
const LEDGER_LIMIT = 200;

/** 원장 전체(최근 결제부터) — `/admin/promotions`. 운영자 게이트 뒤에서만 부른다 */
export async function getPromotionLedger(): Promise<PromotionLedgerRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_promotions")
    .select(
      "payment_id, job_id, tier, weeks, starts_at, ends_at, amount, status, created_at, jobs(title, church_name)",
    )
    .order("created_at", { ascending: false })
    .limit(LEDGER_LIMIT);
  if (error) throw new Error(`노출 원장 조회 실패: ${error.message}`);
  return data.flatMap((row) => {
    const status = keyOf(PROMOTION_STATUSES, row.status);
    // 모르는 값은 버린다 — 표 한 줄 때문에 원장 전체가 죽는 것보다 낫다(row-map과 같은 태도)
    if (!isExposureProduct(row.tier) || !isExposureWeeks(row.weeks) || status === null) return [];
    return [
      {
        paymentId: row.payment_id,
        jobId: row.job_id,
        // FK NOT NULL이라 공고 행은 늘 있지만, 삭제 CASCADE 직후의 창을 대비해 빈 값을 둔다
        jobTitle: row.jobs?.title ?? "(삭제된 공고)",
        churchName: row.jobs?.church_name ?? "",
        tier: row.tier,
        weeks: row.weeks,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        amount: row.amount,
        status,
        createdAt: row.created_at,
      },
    ];
  });
}
