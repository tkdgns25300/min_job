"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// 운영자 셸 네비 — 활성 표시(usePathname). 대기 카운트 배지는 홈(§4)에서 추가.
const NAV: { href: string; label: string; exact?: boolean }[] = [
  { href: "/admin", label: "홈", exact: true },
  { href: "/admin/ingest", label: "수집·등록" },
  { href: "/admin/jobs", label: "공고 관리" },
  { href: "/admin/verify", label: "교회 인증" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

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
