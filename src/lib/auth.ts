import type { CurrentUser } from "@/types/domain";

// 교회 view 개방 조건 — 인증된 교회 소속(church_id 연결 + 인증 완료). DATA §3 파생 규칙.
// client-safe(타입만 의존) — 헤더 위젯·authed 페이지 공용.
export function hasChurchAccess(user: CurrentUser): boolean {
  return user.churchId !== null && user.churchVerificationStatus === "APPROVED";
}

// 게이트가 미인증 사용자를 로그인으로 보낼 때의 URL — 원래 경로를 ?next=로 실어 로그인 후 복귀시킨다.
// 서버 컴포넌트는 현재 pathname을 안정적으로 알 수 없어(Next 16 App Router) 게이트가 자기 경로를 넘긴다.
// next는 로그인 폼에서 다시 내부 경로인지 검증한다(오픈 리다이렉트 방지).
export function loginPathWithNext(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
