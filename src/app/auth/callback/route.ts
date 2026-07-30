import { NextResponse } from "next/server";
import { loginErrorPath, loginPathWithNext, safeInternalPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// OAuth 콜백 — 구글이 돌려준 code를 세션 쿠키로 교환한다(PKCE).
// OAuth 규약이 요구하는 "리다이렉트 수신 지점"이라 route handler를 쓴다(데이터용 REST API 아님).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const next = safeInternalPath(searchParams.get("next"));
  const code = searchParams.get("code");

  if (!code) {
    const providerError = searchParams.get("error");
    // access_denied = 사용자가 동의창에서 취소. 직접 방문도 마찬가지로 정상 흐름이므로
    // "로그인에 실패했어요"를 띄우지 않고 로그인 화면으로만 돌린다(멀쩡한 사용자 겁주지 않기).
    if (!providerError || providerError === "access_denied") {
      return redirectTo(loginPathWithNext(next));
    }
    // 그 외(provider 설정 오류 등)는 진짜 실패 — 안내 + 진단 로그.
    console.error(
      "[auth/callback] provider 오류",
      searchParams.get("error_description") ?? providerError,
    );
    return redirectTo(loginErrorPath(next));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // 만료·재사용된 code나 PKCE 검증 실패 — 화면엔 안 드러나므로 진단 로그가 유일한 단서.
    console.error("[auth/callback] 코드 교환 실패", error);
    return redirectTo(loginErrorPath(next));
  }

  return redirectTo(next);
}

// 상대 경로 Location으로 리다이렉트 — 브라우저가 현재 주소를 기준으로 해석하므로
// 서버가 공개 호스트를 추측할 필요가 없다(x-forwarded-host 신뢰·http/https 오판 문제를 원천 제거).
// 세션 쿠키를 실어 보내는 응답이라 캐시 금지.
function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}
