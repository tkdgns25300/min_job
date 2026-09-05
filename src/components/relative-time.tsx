"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// 상대 시간 표시("N일 전"). 'use cache'/정적 렌더에서 현재 시각은 비결정적이라
// 클라이언트에서 계산한다(CLAUDE 가드레일: 시간 표시는 클라이언트에서).
function daysAgo(date: string): number {
  const then = new Date(`${date}T00:00:00`);
  return Math.floor((Date.now() - then.getTime()) / 86_400_000);
}

function formatRelative(days: number): string {
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

export function RelativeTime({
  date,
  highlightWithinDays,
}: {
  date: string;
  /** 이 일수 안이면 브랜드색으로 강조 — 카드가 "새 공고" 배지 대신 시각의 색으로 말한다(2026-09-06) */
  highlightWithinDays?: number;
}) {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDays(daysAgo(date));
  }, [date]);

  const fresh = highlightWithinDays !== undefined && days !== null && days <= highlightWithinDays;
  return (
    <span suppressHydrationWarning className={cn(fresh && "font-semibold text-primary")}>
      {days === null ? "" : formatRelative(days)}
    </span>
  );
}
