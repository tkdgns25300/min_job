"use client";

import { useEffect, useState } from "react";

// 상대 시간 표시("N일 전"). 'use cache'/정적 렌더에서 현재 시각은 비결정적이라
// 클라이언트에서 계산한다(CLAUDE 가드레일: 시간 표시는 클라이언트에서).
function formatRelative(date: string): string {
  const then = new Date(`${date}T00:00:00`);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

export function RelativeTime({ date }: { date: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(formatRelative(date));
  }, [date]);

  return <span suppressHydrationWarning>{text}</span>;
}
