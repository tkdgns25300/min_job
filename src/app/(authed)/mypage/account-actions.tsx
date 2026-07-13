"use client";

import { useRouter } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/mock-auth";

// 계정 유틸 — 로그아웃 / 회원탈퇴. mock: 세션 쿠키만 해제.
// ⚠️ 회원탈퇴 실 삭제(계정·북마크·인증 정보 정리)는 Phase 1 Server Action. 지금은 확인 후 로그아웃만.
function clearSession() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function AccountActions() {
  const router = useRouter();

  function goHomeSignedOut() {
    clearSession();
    router.push("/");
    router.refresh();
  }

  function withdraw() {
    if (
      !window.confirm(
        "정말 탈퇴하시겠어요? 저장한 공고·교회 인증 정보가 모두 삭제되며 되돌릴 수 없어요.",
      )
    ) {
      return;
    }
    goHomeSignedOut();
  }

  return (
    <div className="space-y-2">
      {/* 로그아웃 — 일반 행(빨강 텍스트) */}
      <button
        type="button"
        onClick={goHomeSignedOut}
        className="flex w-full items-center rounded-xl border p-4 text-sm font-semibold text-destructive transition-colors hover:bg-muted"
      >
        로그아웃
      </button>
      {/* 회원탈퇴 — danger zone(오클릭 방지: 위험 구역 + 경고 문구 분리) */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
        <div>
          <p className="text-sm font-bold text-destructive">회원탈퇴</p>
          <p className="mt-0.5 text-xs break-keep text-muted-foreground">
            계정·저장한 공고·교회 인증 정보가 모두 삭제되며 되돌릴 수 없어요.
          </p>
        </div>
        <button
          type="button"
          onClick={withdraw}
          className="shrink-0 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10"
        >
          탈퇴하기
        </button>
      </div>
    </div>
  );
}
