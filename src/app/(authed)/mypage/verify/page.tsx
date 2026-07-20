import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { getCurrentUser } from "@/lib/queries/users";
import { BUSINESS_INFO } from "@/constants/business";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "교회 인증 | 민잡", robots: { index: false } };

// 교회 인증 — 사역자 → 교회 담당자 승격 관문. dynamic(인증 의존).
// 실 업로드·이메일 발송·운영자 승인은 Phase 1(Server Actions). 지금은 mock UI.
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
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
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
        <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 p-6 text-center">
          <p className="font-bold text-gold-ink">인증 검토 중이에요</p>
          <p className="mt-2 text-sm leading-relaxed break-keep text-muted-foreground">
            {user.churchName ? `${user.churchName} ` : ""}인증 서류를 운영자가 확인하고
            있어요(영업일 1~2일). 승인되면 공고를 등록·게재할 수 있어요.
          </p>
          <Link
            href="/mypage"
            className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
          >
            마이페이지로
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-sm leading-relaxed break-keep text-muted-foreground">
            공고를 직접 등록·관리하려면 교회 인증이 필요해요. 제출하면 운영자가 확인하고(영업일
            1~2일) 승인되면 공고를 등록할 수 있어요.
          </p>
          <VerifyForm defaultName={user.name ?? ""} defaultEmail={user.email} />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            서류가 없는 교회인가요?{" "}
            <a
              href={`mailto:${BUSINESS_INFO.email}`}
              className="font-semibold text-primary hover:underline"
            >
              운영자에게 공고 등록 요청하기 →
            </a>
          </p>
        </>
      )}
    </>
  );
}
