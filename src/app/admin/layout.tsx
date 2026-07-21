import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

// 운영자 전체 색인 제외 — 하위 admin 페이지가 상속(개별 noindex 불필요).
export const metadata: Metadata = { robots: { index: false } };

// 운영자 전용 셸 — 좌측 사이드바 + 콘텐츠(공개 헤더/푸터 없음).
// ⚠️ 운영자 인증 게이트(allowlist)는 Phase 1 (proxy.ts). 지금은 mock 데이터.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AdminSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
