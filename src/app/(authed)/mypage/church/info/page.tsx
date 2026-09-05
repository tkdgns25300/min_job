import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChurchInfoForm } from "./church-info-form";
import { getChurch } from "@/lib/queries/churches";
import { requireUser } from "@/lib/auth-guard";
import { hasChurchAccess } from "@/lib/auth";

export const metadata: Metadata = { title: "교회 정보 관리" }; // noindex는 (authed) layout 상속

// 교회 정보 관리 — dynamic + 인증. 인증 교회 관리자만. 공고 관리(/mypage/church)와 분리된 전용 페이지.
export default function ChurchInfoPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-[40rem] animate-pulse rounded-2xl bg-muted" />}>
        <ChurchInfoContent />
      </Suspense>
    </div>
  );
}

async function ChurchInfoContent() {
  const user = await requireUser();
  // 미인증은 관리 화면(게이트)으로 — 인증 완료만 정보 편집 가능
  if (!hasChurchAccess(user)) redirect("/mypage/church");
  const church = await getChurch(user.churchId);
  if (!church) redirect("/mypage/church");

  return (
    <>
      <Link
        href="/mypage/church"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 교회 공고 관리
      </Link>
      <header className="mt-2.5">
        <h1 className="text-2xl font-bold">교회 정보</h1>
        <p className="mt-1.5 text-sm leading-relaxed break-keep text-muted-foreground">
          여기에서 관리한 내용이 교회 상세 페이지(공개)에 반영돼요. 사무용 연락처만 예외로, 운영자가
          쓰는 값이라 공개되지 않아요.
        </p>
      </header>
      <div className="mt-6">
        <ChurchInfoForm church={church} />
      </div>
    </>
  );
}
