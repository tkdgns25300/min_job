import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { VerifyForm } from "./verify-form";
import type { CurrentUser } from "@/types/domain";

export const metadata: Metadata = { title: "교회 인증 | 민잡" }; // noindex는 (authed) layout 상속

// 교회 인증 — 사역자 → 교회 담당자 승격 관문. dynamic(인증 의존).
// **접수는 실 배선됐다**(`actions.ts`) — 판정은 운영자가 직접 한다(승인 액션 없음).
// 이메일 인증(인증코드)은 없다 — Google OAuth로 이미 검증된 users.email을 쓴다.
// 상태 세 갈래: PENDING=검토 중 안내 · REJECTED=사유 + 폼 · 그 외(null)=폼.
export default function ChurchVerifyPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-10">
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-2xl bg-muted" />}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}

async function VerifyContent() {
  const user = await requireUser();
  if (user.churchVerificationStatus === "APPROVED") redirect("/mypage/church");

  return (
    <>
      <Link
        href="/mypage"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 마이페이지
      </Link>
      <h1 className="mt-2.5 text-2xl font-bold">교회 인증</h1>
      {user.churchVerificationStatus === "PENDING" ? (
        <PendingNotice churchName={user.churchName} />
      ) : (
        <ApplySection user={user} />
      )}
    </>
  );
}

function PendingNotice({ churchName }: { churchName: string | null }) {
  return (
    <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 p-6 text-center">
      <p className="font-bold text-gold-ink">인증 검토 중이에요</p>
      <p className="mt-2 text-sm leading-relaxed break-keep text-muted-foreground">
        {churchName ? `${churchName} ` : ""}인증 서류를 운영자가 확인하고 있어요(영업일 1~2일).
        승인되면 공고를 등록·게재할 수 있어요.
      </p>
      <Link
        href="/mypage"
        className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
      >
        마이페이지로
      </Link>
    </div>
  );
}

/**
 * 반려된 신청 — **사유를 먼저 보여주고** 폼을 다시 연다. 사유 없이 빈 폼만 주면 신청자는 무엇을
 * 고쳐야 할지 모른다. 재신청은 같은 행을 덮어쓴다(DATA §3 — 이력 테이블이 없다).
 */
function RejectedNotice({ reason }: { reason: string | null }) {
  return (
    <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 p-5">
      <p className="font-bold text-gold-ink">인증이 반려됐어요</p>
      <p className="mt-1.5 text-sm leading-relaxed break-keep text-muted-foreground">
        {reason ?? "확인이 필요해 반려됐어요. 서류와 사무용 연락처를 다시 확인해 주세요."}
      </p>
    </div>
  );
}

function ApplySection({ user }: { user: CurrentUser }) {
  const rejected = user.churchVerificationStatus === "REJECTED";
  return (
    <>
      {rejected && <RejectedNotice reason={user.churchRejectionReason} />}
      <p className="mt-1.5 text-sm leading-relaxed break-keep text-muted-foreground">
        {rejected
          ? "사유를 확인하고 다시 신청해 주세요. 아래 폼이 이전 신청을 대체해요."
          : "공고를 직접 등록·관리하려면 교회 인증이 필요해요. 고유번호증 또는 사업자등록증이 있는 교회만 신청할 수 있어요."}
      </p>
      <VerifyForm defaultName={user.name ?? ""} defaultEmail={user.email} />
      {/* ⛔ "서류가 없는 교회는 운영자에게 공고 등록 요청" 샛길을 없앴다(2026-08-25) — 고유번호증
          보유 교회만 직접 등록한다는 결정을 우회하는 경로였다. 문의는 푸터·about에 있다.
          자격이 없어도 크롤 경로로 공고는 계속 공개된다 — 못 하는 것은 셀프서비스뿐이다 */}
    </>
  );
}
