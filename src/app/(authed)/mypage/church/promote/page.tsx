import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PromoteCheckout } from "./promote-checkout";
import { getChurchDashboard } from "@/lib/queries/users";
import { requireUser } from "@/lib/auth-guard";
import { hasChurchAccess } from "@/lib/auth";

export const metadata: Metadata = { title: "노출 신청 | 민잡" }; // noindex는 (authed) layout 상속

// 노출 상품 결제 — dynamic + 인증. 인증 교회 관리자만(게이트). PortOne 결제창은 promote-checkout에서.
export default function PromotePage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <Suspense fallback={<div className="h-[36rem] animate-pulse rounded-2xl bg-muted" />}>
        <PromoteContent />
      </Suspense>
    </div>
  );
}

async function PromoteContent() {
  const user = await requireUser();
  if (!hasChurchAccess(user)) redirect("/mypage/church");

  const dashboard = await getChurchDashboard(user.churchId);
  // 공개 목록에 실제로 노출되는 공고만 결제 대상 — 만료돼 숨겨진 공고를 상단 고정해도
  // 아무도 볼 수 없다(마감일 경과·상시모집 90일 초과). status만 보면 그런 공고에 과금하게 된다.
  const openJobs = dashboard.managed
    .filter((job) => job.isPubliclyOpen)
    .map((job) => ({ id: job.id, title: job.title }));

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
          공고를 목록·검색 상단에 노출해 더 많은 교역자에게 닿아요.
        </p>
      </header>
      <PromoteCheckout jobs={openJobs} />
    </>
  );
}
