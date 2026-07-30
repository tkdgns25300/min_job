/**
 * 운영자 판정 — `.env`의 `ADMIN_EMAILS`(쉼표 구분)와 로그인 이메일을 대조한다.
 *
 * 서버 전용(`NEXT_PUBLIC_` 아님) — 클라이언트에서 import 금지.
 * ⚠️ 목록이 비어 있으면 **아무도 운영자가 아니다**(fail-closed). 설정을 빠뜨렸을 때
 *    admin이 열려버리는 쪽보다 잠기는 쪽이 안전하다.
 * ⚠️ **로그인 제공자를 추가할 때(카카오 등) 반드시 재검토**: 이메일을 키로 쓰므로, 이메일 검증을
 *    안 하는 제공자가 붙으면 같은 주소로 만든 다른 계정이 운영자로 통과할 수 있다.
 *    그때는 email_verified 확인을 추가하거나 allowlist를 user id(uuid)로 바꾼다.
 */
export function isOperatorEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.trim().toLowerCase());
}
