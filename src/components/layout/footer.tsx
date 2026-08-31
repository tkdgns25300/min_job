import Link from "next/link";
import { BUSINESS_INFO, contactMailto } from "@/constants/business";

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
            <a
              href={contactMailto()}
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              문의
            </a>
          </nav>
        </div>
        <hr className="my-6 border-white/10" />
        {/* 전자상거래법 사업자정보 표기 — 통신판매업 미신고 시 해당 항목 생략 (constants/business) */}
        <p className="text-[11px] leading-relaxed text-white/40">
          {[
            BUSINESS_INFO.name,
            `대표 ${BUSINESS_INFO.ceo}`,
            `사업자등록번호 ${BUSINESS_INFO.registrationNumber}`,
            ...(BUSINESS_INFO.ecommerceLicense
              ? [`통신판매업 신고 ${BUSINESS_INFO.ecommerceLicense}`]
              : []),
            BUSINESS_INFO.address,
            // 공개 연락처는 이메일 하나로 통일(운영자 결정 2026-08-31) — 전화는 약관 15조·개인정보처리방침의
            // 사업자 표기(businessInfoLines)에 남는다(KCP 심사 때 낸 정보라 상수에서 지우지 않는다)
            `문의 ${BUSINESS_INFO.email}`,
          ].join(" · ")}
        </p>
        <p className="mt-1 text-xs text-white/45">© 2026 MinJob · 흩어진 사역자 청빙, 한곳에서.</p>
      </div>
    </footer>
  );
}
