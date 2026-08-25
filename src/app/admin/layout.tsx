import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSidebar, AdminSidebarFallback } from "./admin-sidebar";

// 운영자 전체 색인 제외 — 하위 admin 페이지가 상속(개별 noindex 불필요).
export const metadata: Metadata = { robots: { index: false } };

// 운영자 전용 셸 — 좌측 사이드바 + 콘텐츠(공개 헤더/푸터 없음).
// 접근 판정은 proxy.ts가 한다 — /admin/** 은 비로그인 307, 로그인했어도 비운영자면 홈으로.
// 판정 기준 = `.env` ADMIN_EMAILS(`lib/operator.ts`, 목록 비면 fail-closed).
// ⚠️ 이 셸 아래에서 **페이지 게이트가 없는 것은 `/admin/jobs`(목록) 하나**다 — ○ Static을 유지하려고
//    쿠키를 읽지 않기 때문이고, 거기서는 proxy가 유일한 관문이다. 그래서 proxy는 판정 불가(Auth 장애)일
//    때도 admin만은 막는다. 나머지(홈·수집 검수·교회 인증·공고 편집)는 dynamic이라 페이지에서도
//    `requireOperator()`로 재확인한다. (홈은 2026-08-25에 dynamic이 되면서 이 예외에서 빠졌다)
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* 활성 표시(usePathname)는 동적 세그먼트에서 프리렌더할 수 없다 — 경계 없이는 `[id]` 빌드가 막힌다 */}
      <Suspense fallback={<AdminSidebarFallback />}>
        <AdminSidebar />
      </Suspense>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
