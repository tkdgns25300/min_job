import {
  PROMOTION_STATUSES,
  isExposureProduct,
  isExposureWeeks,
  type ExposureProduct,
  type ExposureWeeks,
  type PromotionStatus,
} from "@/constants/domain";
import { keyOf } from "@/lib/domain-enum";
import type { PromotionPeriod, PromotionSpan } from "@/lib/exposure-order";
import { createClient } from "@/lib/supabase/server";

// 데이터 소스 seam (노출 구매 원장 `job_promotions`) — 결제 화면·결제 액션·운영자 화면이 쓴다.
//
// ⚠️ **`'use cache'`를 쓰지 않는다.** 정원("이번 주 스페셜이 찼나")은 결제가 들어오는 순간 바뀌고, 캐시된 답으로
//    자리를 팔면 초과 판매가 된다. 인증 화면·Server Action 뒤에서만 부르므로 `server.ts`(쿠키 세션)로 읽는다.
// ⚠️ **정원 판정은 모든 교회의 행을 봐야 한다.** RLS를 켤 때(DATA §9) `job_promotions` SELECT를 "본인 교회만"으로
//    두면 이 조회가 자기 행만 세어 **조용히 초과 판매**한다 — 그날 이 함수는 `service.ts`로 옮기거나(비PII: 등급·기간·
//    공고 id) 정책이 PAID 행의 그 네 칸을 전원에게 열어야 한다. 화면엔 주별 집계(`weeklySales`)만 내려간다.
// 원장에 **쓰는 곳은 결제 액션 하나**다(`mypage/church/promote/actions.ts`) — 여기는 읽기만.

/** 자리를 차지하는 상태 — 정원·경합 판정은 이것만 센다(취소·환불은 자리가 아니다) */
const PAID = "PAID" satisfies PromotionStatus;

/**
 * 기간과 겹치는 **유효(PAID) 구매** — 정원·겹침 판정의 입력(`lib/exposure-order`).
 * 취소·환불(CANCELLED·REFUNDED)은 자리를 차지하지 않으므로 처음부터 뺀다.
 */
export async function getPaidPromotionsOverlapping(
  period: PromotionPeriod,
): Promise<PromotionSpan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_promotions")
    .select("job_id, tier, starts_at, ends_at, payment_id, created_at")
    .eq("status", PAID)
    .lte("starts_at", period.endsAt)
    .gte("ends_at", period.startsAt);
  if (error) throw new Error(`노출 구매 조회 실패: ${error.message}`);
  // tier는 `text + CHECK`라 string으로 온다 — 모르는 값은 버린다(정원 판정에서 자리를 안 차지하는 쪽으로)
  return data.flatMap((row) =>
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
