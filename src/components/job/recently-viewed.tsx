"use client";

import { useEffect, useState } from "react";

// localStorage 기반 최근 본 공고 (로그인 불필요). 공고 상세에서 기록 예정 — 지금은 비어 있음.
export function RecentlyViewed() {
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("minjob:recentJobs");
      // 마운트 시 클라이언트 전용 localStorage 읽기 (SSR엔 없음) — effect에서 setState가 불가피
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // 파싱 실패는 무시
    }
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-muted-foreground">최근 본 공고</p>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          최근 본 공고가 여기 표시됩니다.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 5).map((it) => (
            <li key={it.id}>
              <a
                href={`/jobs/${it.id}`}
                className="line-clamp-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {it.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
