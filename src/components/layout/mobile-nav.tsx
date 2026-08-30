"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// 모바일 상단 네비 — 데스크톱 인라인 nav(sm:flex)가 감춰지는 sm 미만 구간에서만 노출.
// 햄버거 → 좌측 Sheet. 구직자 탐색(공고) + 서비스/교회 여정 진입(소개·노출 안내)만 담고
// 약관·문의 등 법적·부가 링크는 footer에 맡긴다(footer 덤프 지양).
// ⚠️ 활성 표시(usePathname)는 두지 않는다 — Cache Components에서 request-dynamic 데이터를
//    <Suspense> 밖에서 읽으면 정적 셸이 깨진다(데스크톱 nav도 활성 표시 없음).
const MOBILE_NAV_LINKS = [
  { href: "/jobs", label: "공고" },
  { href: "/about", label: "소개" },
  { href: "/pricing", label: "공고 노출 안내" },
] as const;

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger
        aria-label="메뉴 열기"
        className="flex size-9 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white sm:hidden"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      {/* 딥그린 헤더와 이어지는 브랜드 패널 — 공유 X 버튼은 다크 대비가 약해 끄고 흰색 닫기로 대체 */}
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-72 gap-0 bg-brand-900 p-0 text-white"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-white/10 p-4">
          <SheetTitle className="text-lg font-extrabold tracking-tight text-white">
            <span className="text-gold">Min</span>Job
          </SheetTitle>
          <SheetClose
            aria-label="메뉴 닫기"
            className="flex size-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </SheetClose>
        </SheetHeader>
        {/* SheetClose가 링크 클릭 시 Sheet를 닫는다(라우트 전환과 함께 자동 닫힘).
            `nativeButton={false}` — render가 <a>(Link)라 Base UI가 "native <button>을 기대했다"는
            콘솔 에러를 매 페이지 로드마다 냈다(2026-08-30 전수 점검에서 발견). 링크는 링크로 남긴다 */}
        <nav className="flex flex-col gap-1 p-2">
          {MOBILE_NAV_LINKS.map((link) => (
            <SheetClose
              key={link.href}
              nativeButton={false}
              render={
                <Link
                  href={link.href}
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                />
              }
            >
              {link.label}
            </SheetClose>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
