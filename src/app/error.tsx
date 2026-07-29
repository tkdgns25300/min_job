"use client";

import { useEffect } from "react";
import Link from "next/link";

// 세그먼트 에러 경계 — (public)/admin/(authed) 하위에서 던져진 에러를 잡는다.
// 루트 레이아웃 안에서만 렌더되므로 헤더·푸터 없이 스스로 완결되는 브랜드 화면으로 구성한다.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 원본 에러는 사용자에게 노출하지 않고 콘솔에만 기록한다.
    console.error(error);
  }, [error]);

  return (
    <main className="bg-hero flex flex-1 flex-col items-center justify-center px-4 py-20 text-center text-white">
      <Link href="/" className="text-xl font-extrabold tracking-tight">
        <span className="text-gold">Min</span>Job
      </Link>

      <p className="mt-12 text-sm font-semibold tracking-wide text-gold">잠시 문제가 생겼어요</p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.02em] break-keep sm:text-3xl">
        페이지를 불러오지 못했어요
      </h1>
      <p className="mt-3 max-w-md leading-relaxed break-keep text-white/70">
        일시적인 문제일 수 있어요. 잠시 후 다시 시도하거나, 홈에서 다시 시작해 주세요.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-white px-6 py-3 font-bold text-primary transition-colors hover:bg-white/90"
        >
          다시 시도
        </button>
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
