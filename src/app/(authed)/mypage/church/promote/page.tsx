import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PromoteCheckout } from "./promote-checkout";
import { PromoteComplete } from "./promote-complete";
import { getChurchDashboard } from "@/lib/queries/users";
import { getPaidPromotionsOverlapping } from "@/lib/queries/promotions";
import { requireUser } from "@/lib/auth-guard";
import { hasChurchAccess } from "@/lib/auth";
import { EXPOSURE_WEEKS, START_WINDOW_DAYS } from "@/constants/domain";
import {
  periodsByJob,
  promotionPeriod,
  startDateOptions,
  type CapacitySpan,
} from "@/lib/exposure-order";
import { addDays, todayInSeoul } from "@/lib/job-visibility";

export const metadata: Metadata = { title: "노출 신청 | 민잡" }; // noindex는 (authed) layout 상속

// 가장 긴 상품을 가장 늦은 시작일에 사면 끝나는 날까지 — 정원 판정에 필요한 원장 범위
const LONGEST_WEEKS = Math.max(...EXPOSURE_WEEKS) as (typeof EXPOSURE_WEEKS)[number];

type SearchParams = Promise<{
  paymentId?: string | string[];
  code?: string | string[];
  message?: string | string[];
}>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

// 노출 상품 결제 — dynamic + 인증. 인증 교회 관리자만(게이트). PortOne 결제창은 promote-checkout에서.
// `?paymentId=`가 있으면 **모바일 복귀**다 — 결제창이 `redirectUrl`로 돌려보내며 실은 값으로 완료 처리를 이어간다.
// `?code=`까지 있으면 결제창에서 취소·실패한 복귀라 청구가 없다 — 결제 화면을 그 사유와 함께 다시 그린다.
export default function PromotePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <Suspense fallback={<div className="h-[36rem] animate-pulse rounded-2xl bg-muted" />}>
        <PromoteContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PromoteContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!hasChurchAccess(user)) redirect("/mypage/church");

  const params = await searchParams;
  const paymentId = one(params.paymentId);
  const failed = one(params.code) !== null;
  const returning = paymentId !== null && !failed;

  const today = todayInSeoul();
  const lastStart = addDays(today, START_WINDOW_DAYS - 1);
  const horizon = { startsAt: today, endsAt: promotionPeriod(lastStart, LONGEST_WEEKS).endsAt };
  const [dashboard, paid] = returning
    ? [null, []]
    : await Promise.all([getChurchDashboard(user.churchId), getPaidPromotionsOverlapping(horizon)]);

  // 공개 목록에 실제로 노출되는 공고만 결제 대상 — 만료돼 숨겨진 공고를 상단 고정해도
  // 아무도 볼 수 없다(마감일 경과·상시모집 90일 초과). status만 보면 그런 공고에 과금하게 된다.
  const openJobs =
    dashboard?.managed
      .filter((job) => job.isPubliclyOpen)
      .map((job) => ({ id: job.id, title: job.title })) ?? [];
  // 화면에는 **기간 조각**(등급·시작·종료)과 **이 교회 공고의 마지막 종료일**만 내려간다 — 남의 예약이 누구
  // 것인지는 싣지 않는다. 판정 함수(`lib/exposure-order`)는 결제 액션과 같다 — 화면은 안내, 액션이 최종.
  const spans: CapacitySpan[] = paid.map(({ tier, startsAt, endsAt }) => ({
    tier,
    startsAt,
    endsAt,
  }));
  const held = periodsByJob(
    paid,
    openJobs.map((job) => job.id),
  );

  return (
    <>
      <Link
        href="/mypage/church"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 교회 공고 관리
      </Link>
      <header className="mt-2.5">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
          노출 신청
          {user.churchName && (
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {user.churchName}
            </Badge>
          )}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed break-keep text-muted-foreground">
          공고를 홈 추천·목록 상단·비슷한 공고 첫 칸에 노출해 더 많은 교역자에게 닿아요.
        </p>
      </header>
      {returning ? (
        <PromoteComplete paymentId={paymentId} />
      ) : (
        // 결제자 이메일을 넘긴다 — PortOne 레코드에 실려 결제 확인 문의 때 결제를 특정할 수 있다
        <PromoteCheckout
          jobs={openJobs}
          payerEmail={user.email}
          today={today}
          startDates={startDateOptions(today)}
          spans={spans}
          held={held}
          initialError={failed ? (one(params.message) ?? "결제가 취소되었거나 실패했어요.") : null}
        />
      )}
    </>
  );
}
