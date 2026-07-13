"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccount, SESSION_COOKIE } from "@/lib/mock-auth";
import { hasChurchAccess } from "@/lib/auth";
import type { CurrentUser } from "@/types/domain";

// 헤더 우측 계정 영역 — client island. 세션 쿠키(mj_session)를 클라이언트에서 읽어
// 공개 페이지 'use cache'를 안 깨뜨린다. 아바타는 마이페이지 직행 링크(로그아웃·회원탈퇴는 /mypage 안).
// ⚠️ 실 인증(Phase 1)에선 Supabase 세션 + httpOnly 쿠키로 교체.
function readSession(): CurrentUser | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
  return getAccount(m ? decodeURIComponent(m[1]) : null);
}

// "교회 공고 등록"(파는쪽 상시 진입) 목적지 — 로그인 상태로 분기.
function postJobHref(user: CurrentUser | null): string {
  if (!user) return "/login";
  return hasChurchAccess(user) ? "/mypage/church" : "/mypage/verify";
}

export function HeaderAccount() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    // SSR/하이드레이션 초기엔 로그아웃으로 렌더(공개 캐시와 일치) → 마운트 후 실제 세션 반영
    /* eslint-disable react-hooks/set-state-in-effect */
    setUser(readSession());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return (
    <div className="ml-auto flex items-center gap-3 sm:gap-4">
      <Link
        href={postJobHref(user)}
        className="rounded-full border border-white/25 px-3 py-1.5 text-sm font-semibold text-white/85 transition-colors hover:border-white/45 hover:text-white"
      >
        교회 공고 등록
      </Link>
      {ready && user ? (
        <Link
          href="/mypage"
          aria-label="마이페이지"
          className="flex size-9 items-center justify-center rounded-full bg-gold text-sm font-bold text-brand-900"
        >
          {(user.name ?? user.email).trim().charAt(0)}
        </Link>
      ) : (
        <Link href="/login" className="text-sm text-white/70 transition-colors hover:text-white">
          로그인
        </Link>
      )}
    </div>
  );
}
