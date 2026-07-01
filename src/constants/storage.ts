// localStorage 키 — 로그인 불필요한 클라이언트 저장(북마크·최근 본 공고).
// 계정 귀속 데이터는 Phase 1에서 Supabase로 이관 예정.
export const STORAGE_KEYS = {
  bookmarks: "minjob:bookmarks",
  recentJobs: "minjob:recentJobs",
} as const;
