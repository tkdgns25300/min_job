"use client";

import type { ComponentPropsWithoutRef } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

// 클릭을 세는 링크 — 원문 공고·교회 채널. `<a>` 그대로에 onClick만 얹는다(새 탭·rel은 호출부가 넘긴다).
// `event`가 null이면 세지 않는 평범한 링크다 — 등록 폼의 미리보기가 그 경우(아직 없는 공고 · `JobActions`의
// `disabled`와 같은 이유).
export function TrackedLink({
  event,
  ...anchor
}: { event: AnalyticsEvent | null } & ComponentPropsWithoutRef<"a">) {
  return <a {...anchor} onClick={event ? () => track(event) : undefined} />;
}
