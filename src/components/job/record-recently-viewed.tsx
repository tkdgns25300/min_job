"use client";

import { useEffect } from "react";
import { addRecentJob } from "@/lib/recent-jobs";

// 공고 상세 진입 시 최근 본 공고를 localStorage에 기록한다 (로그인 불필요).
// /jobs 우측 레일·검색 오버레이가 이 값을 읽는다. 렌더링은 없음.
export function RecordRecentlyViewed({
  id,
  title,
  subtitle,
}: {
  id: string;
  title: string;
  subtitle?: string;
}) {
  useEffect(() => {
    addRecentJob({ id, title, subtitle });
  }, [id, title, subtitle]);

  return null;
}
