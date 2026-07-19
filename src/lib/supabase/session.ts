import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// proxy.ts(미들웨어) 세션 refresh 전용 — 단독 사용 X (Phase 1에서 proxy.ts가 호출).
// 요청 쿠키로 Supabase 세션을 갱신하고, 갱신된 쿠키를 응답에 반영해 로그인 유지.
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 세션 refresh(만료 토큰 갱신). getClaims/getUser 호출이 갱신을 트리거한다.
  await supabase.auth.getClaims();
  return response;
}
