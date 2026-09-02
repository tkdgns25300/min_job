// localStorage 키 — 로그인 불필요한 클라이언트 저장(최근 본 공고·최근 검색).
// 북마크는 2026-08-28에 `bookmarks` 표로 옮겨 여기서 빠졌다 — 옛 `minjob:bookmarks` 값은 브라우저에
// 고아로 남지만 아무도 읽지 않는다(지우려면 키를 살려 둬야 해 죽은 코드가 되므로 두었다).
export const STORAGE_KEYS = {
  recentJobs: "minjob:recentJobs",
  recentSearches: "minjob:recentSearches",
  /** 결제창을 띄운 결제번호 — 완료 처리가 끝나기 전에 탭이 닫히거나 세션이 풀려도 다시 열면 이어서 확인한다 */
  pendingPromotionPayment: "minjob:pendingPromotionPayment",
} as const;
