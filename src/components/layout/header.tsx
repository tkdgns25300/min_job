import Link from "next/link";

// 상단 nav = 구직자 탐색 기능만(=공고 하나). 소개는 footer, 노출/광고는 footer+교회 여정.
// 딥그린 브랜드 헤더 — 홈에선 히어로와 이어지고, 다른 페이지에선 상단 브랜드 바.
const NAV_LINKS = [{ href: "/jobs", label: "공고" }] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-brand-900 text-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          <span className="text-gold">Min</span>Job
        </Link>
        {/* 모바일 네비(햄버거/Sheet)는 Phase 1 UI 폴리시에서 */}
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {/* 교회(파는 쪽) 진입 CTA는 헤더에서 제거 — 홈 사이드바 "교회 CTA 카드" + 푸터로 안내 */}
        <Link
          href="/login"
          className="ml-auto text-sm text-white/70 transition-colors hover:text-white"
        >
          로그인
        </Link>
      </div>
    </header>
  );
}
