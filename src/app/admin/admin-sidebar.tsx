"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// 운영자 셸 네비 — 활성 표시(usePathname). 검수 대기 수는 각 페이지(홈·verify)가 표시 — 사이드바 배지는 두지 않음.
const NAV: { href: string; label: string; exact?: boolean }[] = [
  { href: "/admin", label: "홈", exact: true },
  { href: "/admin/review", label: "수집 검수" },
  { href: "/admin/jobs", label: "공고 관리" },
  { href: "/admin/verify", label: "교회 인증" },
];

export function AdminSidebar() {
  return <SidebarFrame pathname={usePathname()} />;
}

/**
 * 활성 표시 없는 사이드바 — `<Suspense>` fallback 전용.
 *
 * `usePathname()`은 **동적 세그먼트(`[id]`)에서는 프리렌더 시점에 알 수 없는 값**이라 경계가 없으면
 * 빌드가 막힌다(cacheComponents). 스켈레톤 대신 **링크가 다 들어간 같은 사이드바**를 내보내는 이유:
 * 메뉴는 상수라 기다릴 이유가 없고, 스트림으로 따라오는 것은 강조 표시 하나뿐이다.
 */
export function AdminSidebarFallback() {
  return <SidebarFrame pathname={null} />;
}

function SidebarFrame({ pathname }: { pathname: string | null }) {
  const isActive = (href: string, exact?: boolean) =>
    pathname !== null &&
    (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <aside className="bg-brand-900 text-white md:min-h-dvh md:w-52 md:shrink-0">
      <div className="px-4 py-4">
        <Link href="/admin" className="text-base font-extrabold tracking-tight">
          <span className="text-gold">Min</span>Job
          <span className="ml-1.5 text-xs font-semibold text-white/55">admin</span>
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible md:pb-4">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href, item.exact) ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              isActive(item.href, item.exact)
                ? "bg-white/12 text-white"
                : "text-white/65 hover:bg-white/5 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
