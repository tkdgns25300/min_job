import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";

/**
 * 요청 헤더를 덧붙여 통과 응답을 만든다 — 프록시가 앱(서버 컴포넌트)에 정보를 넘기는 공식 통로.
 *
 * ⚠️ 헤더는 호출 시점에 `new Headers(request.headers)`로 **새로** 만든다.
 *    `NextResponse.next`는 생성 순간의 헤더를 스냅샷하고, `RequestCookies.set`은 쿠키를
 *    `request.headers`에 되쓴다 → 쿠키를 바꾼 **뒤에** 다시 만들어야 갱신된 토큰이 전달된다.
 */
export function nextWithHeaders(request: NextRequest, extraHeaders: Record<string, string>) {
  const headers = new Headers(request.headers);
  Object.entries(extraHeaders).forEach(([name, value]) => headers.set(name, value));
  return NextResponse.next({ request: { headers } });
}

// proxy.ts(Next 16 Proxy) 세션 refresh 전용 — 단독 사용 X.
// 갱신된 토큰은 두 곳 모두에 심어야 한다(공식 패턴):
//   request.cookies  → 같은 요청의 서버 컴포넌트가 새 토큰을 보게 (안 하면 페이지가 옛 토큰으로 재갱신 시도)
//   response.cookies → 브라우저에 저장돼 다음 요청부터 유지
// request 쿠키를 바꾼 뒤 응답을 다시 만들어야 반영되므로 setAll 안에서 response를 재생성한다.
//
// extraRequestHeaders: 프록시가 앱에 전달할 요청 헤더(현재 경로 등). 여기서는 내용을 해석하지 않는다.
export async function updateSession(
  request: NextRequest,
  extraRequestHeaders: Record<string, string>,
) {
  const buildResponse = () => nextWithHeaders(request, extraRequestHeaders);
  let response = buildResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = buildResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 세션 refresh(만료 토큰 갱신)를 트리거하고, 로그인 여부를 함께 돌려준다.
  // getClaims는 JWT 서명을 검증하므로 프록시 게이트 판단에 쓸 수 있다(위조 쿠키로 통과 불가).
  // 단 최종 권한 판단은 페이지의 getCurrentUser(getUser, Auth 서버 조회)가 한다.
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  return {
    response,
    isAuthenticated: claims != null,
    // 운영자 판정용 — JWT claims에 들어 있어 추가 왕복 없이 읽는다(서명 검증된 값).
    userEmail: typeof claims?.email === "string" ? claims.email : null,
    isAuthUnavailable: isTransientAuthError(error),
  };
}

/**
 * Auth 서버에 닿지 못했거나 서버 오류인가(= 사용자의 세션 상태를 "모른다").
 *
 * ⚠️ 만료·회수된 토큰(4xx: "Refresh token is not valid")을 여기 포함하면 게이트가 열려버린다.
 *    세션 만료는 가장 흔한 상태이므로, 4xx는 "세션 없음"으로 확정해 차단해야 한다.
 * 반대로 진짜 장애(네트워크 status 0 · 5xx)에서 차단하면, claims는 못 읽었지만 getUser는
 * 되는 상황에서 프록시↔페이지가 서로 튕겨 무한 루프가 된다 → 이때는 통과시키고
 * 페이지의 requireUser가 최종 판단한다(데이터는 새지 않는다).
 */
function isTransientAuthError(error: { status?: number } | null): boolean {
  if (!error) return false;
  return error.status === undefined || error.status === 0 || error.status >= 500;
}
