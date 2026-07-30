"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 로그아웃 — 세션 쿠키는 httpOnly라 서버에서만 해제할 수 있다.
 * scope: "local" = 이 브라우저만. 기본값(global)은 다른 기기 세션까지 끊어 사용자가 놀란다.
 */
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  // 만료된 토큰 등으로 해제가 실패하면 세션이 남을 수 있다 — 화면엔 안 드러나므로 로그로 남긴다.
  if (error) console.error("[auth] 로그아웃 실패", error);
  redirect("/");
}
