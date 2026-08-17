import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "로그인 | 민잡",
  description: "민잡 로그인 — Google 계정으로 간편하게 시작하세요.",
  robots: { index: false }, // 로그인은 검색 색인 제외(SEO 위생)
};

type LoginPageProps = { searchParams: Promise<{ next?: string; error?: string }> };

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="mx-auto my-auto w-full max-w-sm py-14 text-center sm:py-16">
      <h1 className="text-2xl leading-snug font-extrabold tracking-[-0.02em] break-keep">
        흩어진 사역자 청빙,
        <br />한 곳에서.
      </h1>
      {/* 로그인으로 실제 열리는 것만 적는다 — 관심 공고 저장은 로그인 없이도 되므로(localStorage) 넣지 않는다 */}
      <p className="mt-3 text-sm leading-relaxed break-keep text-muted-foreground">
        우리 교회 공고를 직접 올리려면
        <br />
        로그인 후 교회 인증이 필요해요.
      </p>

      {/* 간편 로그인 — 세션·쿼리를 읽는 dynamic 영역이라 Suspense 경계 안에 둔다 */}
      <div className="mt-8">
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm searchParams={searchParams} />
        </Suspense>
      </div>

      {/* 별도 회원가입 절차 없음 — 첫 로그인이 곧 가입이라 동의 고지를 여기 둔다 */}
      <p className="mt-5 text-xs leading-relaxed break-keep text-muted-foreground">
        처음 로그인하면 자동으로 가입되며,
        <br />
        <Link href="/terms" className="underline hover:text-foreground">
          이용약관
        </Link>
        ·
        <Link href="/privacy" className="underline hover:text-foreground">
          개인정보처리방침
        </Link>
        에 동의하는 것으로 봅니다.
      </p>
    </div>
  );
}

function LoginFormSkeleton() {
  return <div className="h-12 animate-pulse rounded-xl bg-muted" />;
}
