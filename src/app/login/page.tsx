import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EmailLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "로그인 / 회원가입 | 민잡",
  description: "민잡 로그인 — 카카오·네이버·구글 간편 로그인 또는 이메일로 시작하세요.",
  robots: { index: false }, // 로그인은 검색 색인 제외(SEO 위생)
};

// 간편 로그인 프로바이더. 색은 각 브랜드 공식색(우리 테마 토큰 예외).
// 실제 OAuth 배선(Supabase Auth)은 Phase 1 — 지금은 정적 UI.
type OAuthProvider = { key: string; label: string; className: string; icon: ReactNode };
const OAUTH: OAuthProvider[] = [
  {
    key: "kakao",
    label: "카카오로 시작하기",
    className: "bg-[#FEE500] text-black/85",
    icon: (
      <svg className="size-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.2-.1 2.6-1.8 3.6-2.5.7.1 1.4.2 2.1.2 5.5 0 10-3.6 10-8.8S17.5 3 12 3Z" />
      </svg>
    ),
  },
  {
    key: "naver",
    label: "네이버로 시작하기",
    className: "bg-[#03C75A] text-white",
    icon: (
      <svg className="size-[15px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M5 4h5l4.5 7V4H19v16h-5l-4.5-7v7H5V4Z" />
      </svg>
    ),
  },
  {
    key: "google",
    label: "Google로 시작하기",
    className: "border border-[#dadce0] bg-white text-[#3c4043]",
    icon: (
      <svg className="size-[18px]" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M23 12.3c0-.9-.1-1.5-.2-2.2H12v4h6.3c-.1 1-.8 2.6-2.4 3.6l3.7 2.9c2.2-2 3.6-5 3.6-8.3Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.2 0 5.9-1.1 7.8-2.9l-3.7-2.9c-1 .7-2.3 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5l-3.8 2.9C3.4 21.3 7.4 24 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.3 14.4c-.2-.7-.4-1.4-.4-2.4s.2-1.7.4-2.4L1.5 6.7C.7 8.3.3 10.1.3 12s.4 3.7 1.2 5.3l3.8-2.9Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.8c1.8 0 3.3.6 4.5 1.7l3.3-3.2C17.9 1.4 15.2.3 12 .3 7.4.3 3.4 3 1.5 6.7l3.8 2.9C6.2 6.9 8.9 4.8 12 4.8Z"
        />
      </svg>
    ),
  },
];

export default function LoginPage() {
  return (
    <div className="mx-auto my-auto w-full max-w-sm py-14 text-center sm:py-16">
      <h1 className="text-2xl leading-snug font-extrabold tracking-[-0.02em] break-keep">
        흩어진 사역자 청빙,
        <br />한 곳에서.
      </h1>
      <p className="mt-3 text-sm leading-relaxed break-keep text-muted-foreground">
        로그인하고 공고를 등록·관리하거나
        <br />
        관심 공고를 저장하세요.
      </p>

      {/* 간편 로그인 */}
      <div className="mt-8 space-y-2.5">
        {OAUTH.map((provider) => (
          <button
            key={provider.key}
            type="button"
            className={`relative flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold transition-opacity hover:opacity-90 ${provider.className}`}
          >
            <span className="absolute left-4 flex">{provider.icon}</span>
            {provider.label}
          </button>
        ))}
      </div>

      {/* 구분선 */}
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        또는 이메일로 로그인
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* 이메일 로그인 (mock 동작 — lib/mock-auth) */}
      <EmailLoginForm />

      {/* 회원가입·비밀번호 재설정은 Phase 1(Supabase Auth). 지금은 라우트가 없어 안내만 (가짜 링크 X) */}
      <p className="mt-5 text-sm break-keep text-muted-foreground">
        회원가입·비밀번호 찾기는 <span className="font-semibold text-foreground">준비 중</span>이에요.
      </p>

      {/* mock 테스트 계정 안내 — 실 인증(Phase 1)에서 제거 */}
      <p className="mt-6 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        테스트 계정 · 비밀번호 <b className="font-semibold text-foreground">test1234</b>
        <br />
        인증 교회 <b className="font-semibold text-foreground">test1@test.com</b> · 미인증{" "}
        <b className="font-semibold text-foreground">test2@test.com</b>
      </p>
    </div>
  );
}
