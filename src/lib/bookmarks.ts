import { STORAGE_KEYS } from "@/constants/storage";

// localStorage 기반 북마크(찜) — 로그인 불필요. 계정 귀속 북마크는 Phase 1(/mypage)에서 Supabase로.
const KEY = STORAGE_KEYS.bookmarks;

export function readBookmarks(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function isBookmarked(id: string): boolean {
  return readBookmarks().includes(id);
}

/** 토글 후 저장 여부 반환 */
export function toggleBookmark(id: string): boolean {
  try {
    const ids = readBookmarks();
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
    localStorage.setItem(KEY, JSON.stringify(next));
    return next.includes(id);
  } catch {
    return isBookmarked(id);
  }
}
