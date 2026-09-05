"use client";

import { useEffect } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

// 그려질 때 이벤트 하나를 보낸다 — "여기까지 왔다"가 사실인 지점에 심는다(공고 상세 조회 · 결제 결과 도착).
// 렌더링은 없다. 서버 컴포넌트가 심을 수 있게 이벤트를 prop으로 받는다(직렬화되는 평범한 객체).
export function TrackEvent({ event }: { event: AnalyticsEvent }) {
  // 객체 prop은 렌더마다 새 참조다 — 그대로 의존성에 두면 매 렌더 다시 보내므로 내용으로 비교한다
  const serialized = JSON.stringify(event);
  useEffect(() => {
    track(JSON.parse(serialized) as AnalyticsEvent);
  }, [serialized]);
  return null;
}
