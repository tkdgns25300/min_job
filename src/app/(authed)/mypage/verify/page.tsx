import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { contactMailto } from "@/constants/business";
import { VerifyForm } from "./verify-form";
import type { CurrentUser } from "@/types/domain";

export const metadata: Metadata = { title: "교회 인증 | 민잡" }; // noindex는 (authed) layout 상속

// 교회 인증 — 사역자 → 교회 담당자 승격 관문. dynamic(인증 의존).
// 실 업로드·운영자 승인·결과 알림 메일은 Phase 1(Server Actions) — 화면만 있고 제출은 안 된다.
// 이메일 인증(인증코드)은 없다 — Google OAuth로 이미 검증된 users.email을 쓴다.
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

function ApplySection({ user }: { user: CurrentUser }) {
  return (
    <>
      <p className="mt-1.5 text-sm leading-relaxed break-keep text-muted-foreground">
        공고를 직접 등록·관리하려면 교회 인증이 필요해요.
      </p>
      <VerifyForm defaultName={user.name ?? ""} defaultEmail={user.email} />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        서류가 없는 교회인가요?{" "}
        <a href={contactMailto()} className="font-semibold text-primary hover:underline">
          운영자에게 공고 등록 요청하기 →
        </a>
      </p>
    </>
  );
}
