"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// mock 단계 — 실제 인증(Supabase Auth 카카오/이메일)은 Phase 1에서 배선.
// 실구현 시: 제출 중 disabled+스피너, 실패 인라인 에러(text-destructive),
// 이미 로그인 상태면 ?next= 또는 홈으로 redirect (fable.md /login).
// TODO(design): ❓ 카카오 버튼 색 — 카카오 가이드 노랑(#FEE500)은 "새 색 발명 금지"의
// 외부 브랜드 예외로 허용할지, 중립 아웃라인으로 갈지 — 사람 결정 필요 (fable.md #7). 기본은 중립.
// TODO(design): ❓ 가입/로그인 화면 분리 여부 — Supabase Auth 구성 확정 후 (fable.md /login)
export function LoginForm() {
  const [notice, setNotice] = useState(false);
  const showNotice = () => setNotice(true);

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full"
        onClick={showNotice}
      >
        <MessageCircle /> 카카오로 계속하기
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        또는
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          showNotice();
        }}
      >
        <Input type="email" required placeholder="이메일" aria-label="이메일" className="h-10" />
        <Input
          type="password"
          required
          placeholder="비밀번호"
          aria-label="비밀번호"
          className="h-10"
        />
        <Button type="submit" size="lg" className="h-11 w-full">
          이메일로 로그인
        </Button>
      </form>

      {notice && (
        <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
          로그인은 준비 중이에요. 곧 열릴게요.
        </p>
      )}
    </div>
  );
}
