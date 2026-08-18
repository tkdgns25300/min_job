import type { CurrentUser } from "@/types/domain";

// 인증 공용 헬퍼 — 순수 함수만(서버 전용 import 없음). 실제 게이트는 lib/auth-guard.ts.
// ⚠️ `safeInternalPath`는 오픈 리다이렉트를 막는 **신뢰 경계**다. 반드시 서버(Server Action·route
//    handler·서버 컴포넌트)에서 호출할 것 — 클라이언트에서 "미리 검증"하는 용도로 쓰지 않는다.
//    서버 검증이 유일한 방어선이어야 한다(클라이언트 검증은 공격자가 건너뛸 수 있다).

// 교회 view 개방 조건 — DATA §3 파생 규칙. **사람과 교회 양쪽이 다 승인돼야** 한다:
// 사람만 승인하고 교회가 미검증이면 검수 안 끝난 교회가 공고를 올린다.
// 타입 술어라 통과 후 `user.churchId`가 `string`으로 좁혀진다 — 교회 권한 판정이 곧 churchId 보장.
// null뿐 아니라 빈 문자열도 여기서 걸러, 호출부가 churchId를 다시 확인하지 않아도 되게 한다.
export function hasChurchAccess(user: CurrentUser): user is CurrentUser & { churchId: string } {
  return (
    Boolean(user.churchId) && user.churchVerificationStatus === "APPROVED" && user.churchIsVerified
  );
}

// 게이트가 미인증 사용자를 로그인으로 보낼 때의 URL — 원래 경로를 ?next=로 실어 로그인 후 복귀시킨다.
// 서버 컴포넌트는 현재 pathname을 알 수 없어(Next 16) proxy가 PATHNAME_HEADER로 넘겨준다(아래 참조).
// next는 아래 safeInternalPath로 다시 검증한다(오픈 리다이렉트 방지).
export function loginPathWithNext(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

// OAuth 실패 시 로그인으로 되돌리는 URL — 복귀 경로를 유지해 재시도 후 원래 자리로 보낸다.
export function loginErrorPath(next: string): string {
  return `${loginPathWithNext(next)}&error=oauth`;
}

// 로그인 후 돌아갈 기본 경로 — ?next=가 없거나 안전하지 않을 때.
const DEFAULT_REDIRECT = "/mypage";

/**
 * proxy.ts가 요청 헤더로 넘겨주는 현재 경로(+쿼리).
 * 서버 컴포넌트는 자기 pathname을 알 수 없어(Next 16) 게이트가 복귀 경로를 만들 수 없다.
 * → 경로 지식을 proxy.ts 한 곳에만 두기 위한 통로. 값은 항상 safeInternalPath로 검증해 쓴다.
 */
export const PATHNAME_HEADER = "x-pathname";

// 안전하지 않은 문자 — 제어문자(C0 전체: TAB·CR·LF 포함)·공백·DEL·역슬래시.
// 정규식 대신 문자코드로 비교한다(이스케이프 표기 실수로 범위가 어긋나는 사고를 원천 차단).
function hasUnsafeChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f || char === "\\") return true;
  }
  return false;
}

// 오픈 리다이렉트 방지 — 우리 사이트 내부 절대경로(/…)만 허용한다.
// //evil.com(protocol-relative) · http(s):// · 상대경로는 기본값으로 막는다.
// raw는 URLSearchParams가 이미 디코딩한 값이라 %2F%2F 우회도 //로 풀려 걸러진다.
//
// ⚠️ 제어문자·역슬래시를 반드시 함께 막아야 한다: 브라우저 URL 파서는 TAB·CR·LF를
//    파싱 **전에 제거**하므로 `/<TAB>/evil.com`이 `//evil.com`(= 외부 origin)으로 해석된다.
//    `?next=/%09/evil.com`이 OAuth 왕복을 거쳐 리다이렉트되면 "정상 구글 로그인 직후
//    공격자 사이트"가 되므로 치명적이다. CR/LF는 Location 헤더 예외(500)도 유발한다.
// OAuth 시작(actions.ts)과 콜백(auth/callback) 양쪽에서 쓰므로 여기 둔다 — 검증 로직 중복 금지.
export function safeInternalPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return DEFAULT_REDIRECT;
  if (hasUnsafeChar(raw)) return DEFAULT_REDIRECT;
  if (raw.startsWith("//")) return DEFAULT_REDIRECT;
  return raw;
}
