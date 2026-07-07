import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인 | 민잡" };

// 로그인은 공개/인증 셸과 분리된 독립 페이지 — 셸이 없으니 워드마크가 브랜드 앵커.
// 실구현 시 ?next= 리다이렉트 파라미터 처리(게이트에서 튕긴 페이지로 복귀 — 예: /jobs/new).
export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="text-2xl font-extrabold tracking-tight">
            <span className="text-gold">Min</span>Job
          </Link>
          {/* 왜 로그인해야 하는지만 말한다 — 열람은 로그인 없이 가능하다는 서비스 원칙 유지 */}
          <p className="mt-3 text-sm leading-relaxed break-keep text-muted-foreground">
            공고 저장과 교회 공고 등록에 로그인이 필요해요.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>

        {/* 약관 고지 — 법적 필수 (SPEC 비기능 요구) */}
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          로그인 시{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            이용약관
          </Link>
          과{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            개인정보처리방침
          </Link>
          에 동의하게 됩니다.
        </p>
      </div>
    </div>
  );
}
