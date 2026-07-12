"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccount, SESSION_COOKIE } from "@/lib/mock-auth";
import { hasChurchAccess } from "@/types/domain";
import type { CurrentUser } from "@/types/domain";

// 헤더 우측 계정 영역 — client island. 세션 쿠키(mj_session)를 클라이언트에서 읽어
// 공개 페이지 'use cache'를 안 깨뜨린다. 로그아웃 상태 = "로그인", 로그인 상태 = 아바타 드롭다운.
// ⚠️ 실 인증(Phase 1)에선 Supabase 세션 + httpOnly 쿠키로 교체.
function readSession(): CurrentUser | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
  return getAccount(m ? decodeURIComponent(m[1]) : null);
}

export function HeaderAccount() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // SSR/하이드레이션 초기엔 로그아웃으로 렌더(공개 캐시와 일치) → 마운트 후 실제 세션 반영
    /* eslint-disable react-hooks/set-state-in-effect */
    setUser(readSession());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  if (!ready || !user) {
    return (
      <Link
        href="/login"
        className="ml-auto text-sm text-white/70 transition-colors hover:text-white"
      >
        로그인
      </Link>
    );
  }

  const canChurch = hasChurchAccess(user);
  const initial = (user.name ?? user.email).trim().charAt(0);

  function logout() {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
    setUser(null);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="계정 메뉴"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full bg-gold text-sm font-bold text-brand-900"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-border bg-card py-1.5 text-foreground shadow-lg">
          <div className="border-b px-3 pb-2 pt-1">
            <p className="truncate text-sm font-bold">{user.name ?? "사역자"}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Link
            href="/mypage"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted"
          >
            마이페이지 <span className="text-xs text-muted-foreground">사역자</span>
          </Link>
          {canChurch && (
            <Link
              href="/mypage/church"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted"
            >
              교회 공고 관리
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                인증
              </span>
            </Link>
          )}
          <button
            type="button"
            onClick={logout}
            className="mt-1 block w-full border-t px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
