import type { Metadata } from "next";
import Link from "next/link";

// 앱 루트 not-found — (public) 그룹 레이아웃(헤더·푸터)을 받지 않고 루트 레이아웃 안에서만
// 렌더된다. 그래서 로그인 페이지처럼 로고를 상단에 두고 스스로 완결되는 브랜드 화면으로 구성한다.
export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요 | 민잡",
  description: "요청하신 공고나 페이지를 찾을 수 없습니다.",
};

export default function NotFound() {
  return (
    <main className="bg-hero flex flex-1 flex-col items-center justify-center px-4 py-20 text-center text-white">
      <Link href="/" className="text-xl font-extrabold tracking-tight">
        <span className="text-gold">Min</span>Job
      </Link>

      <p className="mt-12 text-sm font-semibold tracking-wide text-gold">페이지를 찾을 수 없어요</p>
      <p className="mt-4 text-7xl font-extrabold tracking-[-0.03em] tabular-nums sm:text-8xl">404</p>
      <h1 className="mt-6 text-xl font-bold break-keep sm:text-2xl">
        찾으시는 공고나 페이지가 없어요
      </h1>
      <p className="mt-3 max-w-md leading-relaxed break-keep text-white/70">
        주소가 바뀌었거나, 청빙이 마감돼 내려갔을 수 있어요. 아래에서 다시 찾아보세요.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/jobs"
          className="rounded-xl bg-white px-6 py-3 font-bold text-primary transition-colors hover:bg-white/90"
        >
          공고 보러 가기
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-white/25 px-6 py-3 font-bold text-white transition-colors hover:bg-white/10"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
