import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/jobs", label: "공고" },
  { href: "/churches", label: "교회" },
  { href: "/pricing", label: "광고 안내" },
  { href: "/about", label: "소개" },
] as const;

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
          <Link href="/jobs/new" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
            공고 등록
          </Link>
        </div>
      </div>
    </header>
  );
}
