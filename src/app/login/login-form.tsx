"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { authenticate, SESSION_COOKIE } from "@/lib/mock-auth";

// 이메일/비밀번호 로그인 (mock) — 테스트 계정 검증 → 세션 쿠키 설정 → /mypage.
// ⚠️ 실 인증(Phase 1)은 Supabase Auth(httpOnly 세션) + `?next=` 리다이렉트로 교체.
export function EmailLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const uid = authenticate(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
    if (!uid) {
      setError("이메일 또는 비밀번호가 올바르지 않아요.");
      return;
    }
    document.cookie = `${SESSION_COOKIE}=${uid}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
    router.push("/mypage");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2.5">
      <Input
        type="email"
        name="email"
        autoComplete="email"
        aria-label="이메일"
        placeholder="이메일"
        className="h-12"
        required
      />
      <Input
        type="password"
        name="password"
        autoComplete="current-password"
        aria-label="비밀번호"
        placeholder="비밀번호"
        className="h-12"
        required
      />
      {error && <p className="text-left text-xs text-destructive">{error}</p>}
      <button
        type="submit"
        className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        로그인
      </button>
    </form>
  );
}
