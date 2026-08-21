import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";

// 쿠키 기반 서버 클라이언트(publishable 키 + RLS) — actions.ts(모든 mutation)·dynamic 페이지 전용.
// 인증 세션을 쿠키로 유지한다. ⚠️ cached scope('use cache')에서 쓰지 말 것 — 쿠키를 만지면 캐시가 깨진다.
// 공개 캐시 read는 service.ts를 쓴다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 set 호출 시 무시 — 세션 갱신은 proxy(session.ts)가 담당
          }
        },
      },
    },
  );
}
