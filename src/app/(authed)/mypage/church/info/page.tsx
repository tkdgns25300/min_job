import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { ChurchInfoForm } from "./church-info-form";
import { getCurrentUser } from "@/lib/queries/users";
import { getChurch } from "@/lib/queries/churches";
import { hasChurchAccess } from "@/lib/auth";

export const metadata: Metadata = { title: "교회 정보 관리 | 민잡", robots: { index: false } };

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
  await connection(); // 인증 의존 — 요청 시점 렌더
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // 미인증은 관리 화면(게이트)으로 — 인증 완료만 정보 편집 가능
  if (!hasChurchAccess(user) || !user.churchId) redirect("/mypage/church");
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
          여기서 관리한 내용이 교회 상세 페이지(공개)와 공고에 반영돼요.
        </p>
      </header>
      <div className="mt-6">
        <ChurchInfoForm church={church} />
      </div>
    </>
  );
}
