import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 상단 nav = 구직자 탐색 기능만(=공고 하나). 소개는 footer, 노출/광고는 footer+교회 여정.
// 로그인 후 마이페이지·내 공고 관리는 좌 nav가 아니라 우측 계정 영역으로 붙는다(Phase 1).
const NAV_LINKS = [{ href: "/jobs", label: "공고" }] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          MinJob
        </Link>
        {/* 모바일 네비(햄버거/Sheet)는 Phase 1 UI 폴리시에서 */}
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            로그인
          </Link>
          {/* 교회(파는 쪽) 진입 CTA — 클릭 시 로그인/가입 게이트(Phase 1) */}
          <Link href="/jobs/new" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
            교회 공고 등록
          </Link>
        </div>
      </div>
    </header>
  );
}
