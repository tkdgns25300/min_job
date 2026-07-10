import Link from "next/link";

// 로그인 전용 미니멀 레이아웃 — 풀 Header/Footer 대신 로고 상단바 + 최소 푸터.
// 로그인은 "집중" 페이지라 이탈 요소(nav)를 걷어냄. 신뢰는 로고 + 약관/개인정보 링크로 확보.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2.5 px-5 py-4">
          <Link href="/" className="text-lg font-extrabold tracking-tight">
            <span className="text-gold">Min</span>Job
          </Link>
          <span className="text-sm font-semibold text-muted-foreground">로그인</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-5">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 text-xs text-muted-foreground">
          <span>© 2026 MinJob</span>
          <nav className="flex gap-4">
            <Link href="/terms" className="transition-colors hover:text-foreground">
              이용약관
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              개인정보처리방침
            </Link>
            <a href="mailto:contact@minjob.kr" className="transition-colors hover:text-foreground">
              문의
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
