// 세션 쿠키 정책 — @supabase/ssr 기본값(httpOnly: false)을 덮어쓴다. server.ts·session.ts 공용.
// httpOnly: 브라우저 Supabase 클라이언트를 쓰지 않으므로(CLAUDE 규칙) JS 접근이 필요 없다 → XSS 탈취 차단
// secure: 배포는 HTTPS 전용. 로컬 http 개발에선 꺼야 쿠키가 저장된다.
// sameSite는 기본 lax 유지 — OAuth 복귀(구글→우리 콜백)가 cross-site 최상위 GET이라 strict면 쿠키가 안 실린다.
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
