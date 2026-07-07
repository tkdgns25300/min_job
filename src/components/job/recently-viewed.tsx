"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readRecentJobs, type RecentJob } from "@/lib/recent-jobs";

// localStorage 기반 최근 본 공고 (로그인 불필요). 공고 상세의 RecordRecentlyViewed가 기록한다.
export function RecentlyViewed() {
  const [items, setItems] = useState<RecentJob[]>([]);

  useEffect(() => {
    // 마운트 시 클라이언트 전용 localStorage 읽기 (SSR엔 없음)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readRecentJobs());
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-muted-foreground">최근 본 공고</p>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          최근 본 공고가 여기 표시됩니다.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
          {items.slice(0, 5).map((it) => (
            <li key={it.id}>
              <Link
                href={`/jobs/${it.id}`}
                className="block px-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <span className="line-clamp-1 text-sm font-medium text-foreground">{it.title}</span>
                {(it.location ?? it.subtitle ?? it.pay) && (
                  <span className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">
                      {it.location ?? it.subtitle}
                    </span>
                    {it.pay && <span className="shrink-0 font-bold text-primary">{it.pay}</span>}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
