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
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user.email) {
    // 만료·재사용된 code나 PKCE 검증 실패 — 화면엔 안 드러나므로 진단 로그가 유일한 단서.
    console.error("[auth/callback] 코드 교환 실패", error);
    return redirectTo(loginErrorPath(next));
  }

  // 프로필 행 만들기 — **세션이 있으면 `public.users` 행도 있다**를 여기서 보장한다.
  //
  // 왜 여기인가: 세션을 발급하는 곳이 이 한 줄(`exchangeCodeForSession`)뿐이라, 콜백을 지나지
  // 않고 로그인된 상태가 되는 경로가 없다. `proxy.ts`의 세션 갱신은 콜백을 타지 않으므로
  // 여기서 놓치면 그 계정은 **영구히** 행 없이 남는다.
  //
  // ⚠️ 실패하면 **세션을 폐기**한다. 위에서 쿠키가 이미 발급됐으므로 그냥 넘기면
  //    "로그인은 됐는데 프로필 행이 없는" 상태가 굳어, 나중에 교회 인증 신청이
  //    갱신할 행을 못 찾아 터진다(그때는 원인이 로그인 시점이라는 걸 알기 어렵다).
  //    로그인이 막히는 건 눈에 보이고 재시도로 풀린다 — 조용히 꼬이는 쪽이 나쁘다.
  // ⚠️ `upsert`라 재시도가 안전하다. 재로그인마다 이메일이 최신으로 맞춰지는 효과도 있다.
  const { error: profileError } = await supabase
    .from("users")
    .upsert({ id: data.user.id, email: data.user.email }, { onConflict: "id" });
  if (profileError) {
    console.error("[auth/callback] 프로필 행 생성 실패 — 세션 폐기", profileError);
    await supabase.auth.signOut();
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
