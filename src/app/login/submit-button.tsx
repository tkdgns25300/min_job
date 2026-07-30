"use client";

import { useFormStatus } from "react-dom";

// 구글 브랜드 로고 — 색은 구글 공식색(우리 테마 토큰 예외).
const GOOGLE_ICON = (
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
);

// 제출 상태(useFormStatus)는 form 안에서만 읽히므로 버튼만 분리한 client 컴포넌트.
// 서버에서도 HTML로 렌더되므로 JS가 없어도 버튼은 보이고 폼 제출은 동작한다(라벨만 안 바뀜).
export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="relative flex h-12 w-full items-center justify-center rounded-xl border border-[#dadce0] bg-white text-sm font-bold text-[#3c4043] transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70"
    >
      <span className="absolute left-4 flex">{GOOGLE_ICON}</span>
      {pending ? "이동 중…" : "Google로 시작하기"}
    </button>
  );
}
