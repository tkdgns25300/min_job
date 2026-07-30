import { NextResponse, type NextRequest } from "next/server";
import { nextWithHeaders, updateSession } from "@/lib/supabase/session";
import { isOperatorEmail } from "@/lib/operator";
import { PATHNAME_HEADER, loginPathWithNext } from "@/lib/auth";

// Next 16 Proxy — ① Supabase 세션 refresh ② 비로그인 1차 차단 ③ /admin 운영자 판정.
// ① 서버 컴포넌트는 쿠키를 쓸 수 없어 만료 토큰 갱신을 여기서 한다(없으면 토큰 만료 후 로그인이 풀린다).
// ② 렌더 전에 도는 유일한 지점이라 **진짜 307**을 낼 수 있다. 페이지 안에서 redirect하면
//    cacheComponents 제약상 Suspense 안이 되어 200 + 스켈레톤으로 나간다(JS 없는 클라이언트엔 무용).
// ⚠️ (authed) 페이지는 requireUser가 최종 방어선이라 여기서 빠뜨려도 데이터가 새지 않지만,
//    **/admin 3개 페이지는 ○ Static이라 페이지 게이트가 없다** → admin은 판정 불가 시 fail-closed.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // 현재 경로를 요청 헤더로 넘긴다 — 페이지 게이트가 복귀 경로를 만들 때 쓴다(경로 지식은 여기만).
  const forwardedHeaders = { [PATHNAME_HEADER]: `${pathname}${search}` };

  try {
    const { response, isAuthenticated, userEmail, isAuthUnavailable } = await updateSession(
      request,
      forwardedHeaders,
    );

    // Auth 장애로 세션을 "모르는" 경우 — (authed)는 페이지 게이트가 받아주므로 통과시키지만,
    // admin은 받아줄 페이지 게이트가 없으므로 막는다(fail-closed).
    if (isAuthUnavailable) {
      return isAdminPath(pathname) ? redirectKeepingCookies(response, "/", request) : response;
    }

    if (!isAuthenticated) {
      if (!isProtectedPath(pathname)) return response;
      return redirectKeepingCookies(response, loginPathWithNext(`${pathname}${search}`), request);
    }

    // 로그인은 했지만 운영자가 아니면 admin은 홈으로 — 운영자 도구의 존재를 드러내지 않는다.
    if (isAdminPath(pathname) && !isOperatorEmail(userEmail)) {
      return redirectKeepingCookies(response, "/", request);
    }

    return response;
  } catch (thrown) {
    // Proxy는 모든 경로 앞단이라 여기서 던지면 공개 페이지까지 500이 된다 → 통과가 기본.
    // 단 admin은 페이지 게이트가 없으니 판정 실패 시에도 막는다.
    console.error("[proxy] 세션 처리 실패", thrown);
    const passThrough = nextWithHeaders(request, forwardedHeaders);
    return isAdminPath(pathname) ? redirectKeepingCookies(passThrough, "/", request) : passThrough;
  }
}

// 갱신·정리된 세션 쿠키를 리다이렉트 응답으로 옮긴다 — 잃으면 같은 판정이 반복돼 루프가 된다.
function redirectKeepingCookies(source: NextResponse, path: string, request: NextRequest) {
  // NextResponse.redirect는 절대 URL을 요구한다 — 요청이 실제로 도달한 origin을 쓴다.
  // (auth/callback은 상대 Location을 쓰지만 여기선 프레임워크 API 제약상 불가)
  const redirected = NextResponse.redirect(new URL(path, request.nextUrl.origin));
  source.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
  return redirected;
}

// 로그인 필요 경로 — (authed) 라우트 그룹은 URL에 안 드러나므로 접두사를 직접 적는다.
// 새 인증 페이지를 추가하면 여기도 추가할 것(안 해도 페이지 게이트가 막지만 307을 잃는다).
const ADMIN_PREFIX = "/admin";
const PROTECTED_PREFIXES = ["/mypage", "/jobs/new", ADMIN_PREFIX] as const;

function isAdminPath(pathname: string): boolean {
  return matchesPrefix(pathname, ADMIN_PREFIX);
}

function isProtectedPath(pathname: string): boolean {
  if (PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return true;
  // /jobs 는 공개, /jobs/[id]/edit 만 보호 대상.
  return /^\/jobs\/[^/]+\/edit$/.test(pathname);
}

// 정확히 일치 또는 하위 경로만 — startsWith만 쓰면 /mypage-fake 같은 404도 잡힌다.
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export const config = {
  // 정적 파일·이미지·메타데이터 라우트는 세션 갱신이 불필요 — 제외해 함수 호출을 줄인다.
  // auth/callback도 제외: 거기서 새 세션 쿠키를 심는데, 갱신 실패 시 나가는 쿠키 삭제와 충돌할 수 있다.
  matcher: [
    "/((?!auth/callback|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
