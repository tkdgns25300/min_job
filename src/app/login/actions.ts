"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { loginErrorPath, safeInternalPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// 구글 간편 로그인 시작 — 서버에서 OAuth URL을 받아 구글로 보낸다(브라우저 클라이언트 X).
// next(로그인 후 복귀 경로)는 콜백까지 쿼리로 실어 보내고, 검증은 여기와 콜백 양쪽에서 한다.
export async function signInWithGoogle(formData: FormData) {
  const raw = formData.get("next");
  const next = safeInternalPath(typeof raw === "string" ? raw : null);
  const authorizeUrl = await googleAuthorizeUrl(next);

  // redirect()는 예외를 던져 흐름을 끊는다 — 아래 try/catch 밖에서 마지막에 호출한다.
  redirect(authorizeUrl ?? loginErrorPath(next));
}

/**
 * 구글 동의 화면 URL. 실패하면 null — 호출부가 로그인 화면으로 되돌린다.
 * 예외까지 삼키는 이유: env 누락·DNS/TLS 실패는 throw로 오는데, 그대로 두면 정성껏 만든
 * `?error=oauth` 안내 대신 500(또는 전체 에러 화면)이 뜬다.
 */
async function googleAuthorizeUrl(next: string): Promise<string | null> {
  try {
    // origin은 브라우저가 보낸 Origin 헤더: Server Action은 Next가 Host와 대조(CSRF)하고,
    // Supabase도 redirectTo를 허용목록과 대조하므로 이중으로 막힌다.
    const origin = (await headers()).get("origin");
    if (!origin) {
      // Origin을 지우는 프록시 뒤에서만 발생 — 로그 없으면 원인 추적이 불가능하다.
      console.error("[auth] Origin 헤더 없음 — OAuth 시작 불가");
      return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error || !data.url) {
      // 대부분 설정 문제(provider 미설정·redirect 허용목록 누락) — 사용자 화면만으론 구분 불가.
      console.error("[auth] OAuth 시작 실패", error);
      return null;
    }
    return data.url;
  } catch (thrown) {
    unstable_rethrow(thrown); // Next 내부 제어 신호는 삼키지 않는다
    console.error("[auth] OAuth 시작 중 예외", thrown);
    return null;
  }
}
