import { STORAGE_KEYS } from "@/constants/storage";

// localStorage 기반 최근 검색어 (로그인 불필요) — 검색 오버레이 전용. 최신순, 중복 제거.
const MAX = 8;

export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.recentSearches);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(list: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(list));
  } catch {
    // 저장 실패 무시
  }
}

export function addRecentSearch(term: string): void {
  const t = term.trim();
  if (!t) return;
  write([t, ...readRecentSearches().filter((it) => it !== t)].slice(0, MAX));
}

/** 단건 삭제 후 갱신된 목록 반환 */
export function removeRecentSearch(term: string): string[] {
  const next = readRecentSearches().filter((it) => it !== term);
  write(next);
  return next;
}

export function clearRecentSearches(): void {
  write([]);
}
