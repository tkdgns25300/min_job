import type { CurrentUser } from "@/types/domain";

// 교회 view 개방 조건 — 인증된 교회 소속(church_id 연결 + 인증 완료). DATA §3 파생 규칙.
// client-safe(타입만 의존) — 헤더 위젯·authed 페이지 공용.
export function hasChurchAccess(user: CurrentUser): boolean {
  return user.churchId !== null && user.churchVerificationStatus === "APPROVED";
}
