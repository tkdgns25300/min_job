import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "소개" },
  { href: "/pricing", label: "공고 노출 안내" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
] as const;

// 딥그린 푸터 — 딥그린 헤더와 위아래로 맞물리는 브랜드 bookend.
export function Footer() {
  return (
    <footer className="bg-brand-900 text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div>
            <p className="text-xl font-extrabold tracking-tight">
              <span className="text-gold">Min</span>Job
            </p>
            <p className="mt-2 text-sm text-white/70">한국교회 사역자 청빙 플랫폼</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-white/70 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            {/* 문의: Phase 1에서 정식 메일 주소로 확정 (현재 placeholder) */}
            <a
              href="mailto:contact@minjob.kr"
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              문의
            </a>
          </nav>
        </div>
        <hr className="my-6 border-white/10" />
        <p className="text-xs text-white/45">© 2026 MinJob · 흩어진 사역자 청빙, 한곳에서.</p>
      </div>
    </footer>
  );
}
