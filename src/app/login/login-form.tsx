"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { authenticate, SESSION_COOKIE } from "@/lib/mock-auth";

// 로그인 후 돌아갈 기본 경로 — ?next=가 없거나 안전하지 않을 때.
const DEFAULT_REDIRECT = "/mypage";

// 오픈 리다이렉트 방지 — 우리 사이트 내부 절대경로(/…)만 허용한다.
// //evil.com(protocol-relative) · /\evil.com · http(s):// · 상대경로는 모두 기본값으로 막는다.
// raw는 URLSearchParams가 이미 디코딩한 값이라 %2F%2F 우회도 //로 풀려 걸러진다.
function safeInternalPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return DEFAULT_REDIRECT;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return DEFAULT_REDIRECT;
  return raw;
}

// 이메일/비밀번호 로그인 (mock) — 테스트 계정 검증 → 세션 쿠키 설정 → next(검증) 또는 /mypage.
// next는 게이트가 붙인 ?next= 쿼리로만 오므로 제출 시점에 브라우저 URL에서 읽는다(로그인 페이지는 정적 유지).
// ⚠️ 실 인증(Phase 1)은 Supabase Auth(httpOnly 세션)로 교체 — next 검증(safeInternalPath)은 그대로 재사용.
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
    const next = safeInternalPath(new URLSearchParams(window.location.search).get("next"));
    router.push(next);
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
