"use client";

import { useEffect } from "react";
import { STORAGE_KEYS } from "@/constants/storage";

const MAX = 10;

// 공고 상세 진입 시 최근 본 공고를 localStorage에 기록한다 (로그인 불필요).
// /jobs 우측 레일의 RecentlyViewed가 이 값을 읽는다. 렌더링은 없음.
export function RecordRecentlyViewed({ id, title }: { id: string; title: string }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.recentJobs);
      const prev: { id: string; title: string }[] = raw ? JSON.parse(raw) : [];
      const next = [{ id, title }, ...prev.filter((it) => it.id !== id)].slice(0, MAX);
      localStorage.setItem(STORAGE_KEYS.recentJobs, JSON.stringify(next));
    } catch {
      // 저장 실패는 무시 (프라이빗 모드 등)
    }
  }, [id, title]);

  return null;
}
