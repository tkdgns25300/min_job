import type { Metadata } from "next";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "교회 인증 검수 | 민잡 운영자" };

// 교회 인증 검수 — 다음 단계에서 구현(제출 목록 → 서류 확인 → 승인/반려).
export default function AdminVerifyPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">교회 인증 검수</h1>
      <p className="text-sm text-muted-foreground">
        제출된 증빙(고유번호증·사업자등록증) 확인 → 승인/반려. 승인 시 공고 게재 자격 부여.
      </p>
      <Placeholder
        label="인증 제출 목록 · 서류 확인 · 승인/반려 (다음 단계)"
        className="min-h-80"
      />
    </div>
  );
}
