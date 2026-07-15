import Link from "next/link";
import { BUSINESS_INFO } from "@/constants/business";

const FOOTER_LINKS = [
  { href: "/about", label: "소개" },
  { href: "/pricing", label: "공고 노출 안내" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
] as const;

// 딥그린 푸터 — 딥그린 헤더와 위아래로 맞물리는 브랜드 bookend.
export function Footer() {
  return (
    <footer className="mt-16 bg-brand-900 text-white sm:mt-20">
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
        {/* 전자상거래법 사업자정보 표기 — 미정 값은 사업자 등록·통신판매업 신고 후 채움 (constants/business) */}
        <p className="text-[11px] leading-relaxed text-white/40">
          {[
            BUSINESS_INFO.name || "[상호]",
            `대표 ${BUSINESS_INFO.ceo || "[대표자]"}`,
            `사업자등록번호 ${BUSINESS_INFO.registrationNumber}`,
            `통신판매업 신고 ${BUSINESS_INFO.ecommerceLicense || "[신고 후]"}`,
            BUSINESS_INFO.address || "[사업장 주소]",
          ].join(" · ")}
        </p>
        <p className="mt-1 text-xs text-white/45">© 2026 MinJob · 흩어진 사역자 청빙, 한곳에서.</p>
      </div>
    </footer>
  );
}
