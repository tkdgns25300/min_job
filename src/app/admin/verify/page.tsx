import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getVerifications } from "@/lib/queries/verifications";
import { AdminVerifyView } from "./admin-verify-view";

export const metadata: Metadata = { title: "교회 인증 검수 | 민잡 운영자" };

// 교회 인증 검수 — 유일한 검수 게이트(공고 검수 없음). dynamic(운영자 전용 + PII, 'use cache' 금지).
// 셸 헤더는 정적, 목록은 <Suspense>로 스트리밍. 검수 대기 수는 검수중 탭(기본 선택) 배지로.
export default function AdminVerifyPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">교회 인증 검수</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          증빙 서류(고유번호증·사업자등록증) 확인 후 승인/반려. 승인 시 공고 게재 자격 부여.
        </p>
      </header>
      <Suspense fallback={<VerifySkeleton />}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}

async function VerifyContent() {
  await connection(); // 운영자 전용 · PII — 요청 시점 렌더(실구현: proxy 게이트 + operator RLS server.ts)
  const verifications = await getVerifications();
  return <AdminVerifyView verifications={verifications} />;
}

function VerifySkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-9 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
