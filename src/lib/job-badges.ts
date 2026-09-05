import { DEADLINE_SOON_DAYS } from "@/constants/domain";
import type { JobCard } from "@/types/domain";

// 카드 배지 규칙(순수) — 격자 카드·목록 로우·교회 페이지 카드·저장 목록이 같은 답을 쓴다.
// 배지는 **그 공고에만 있는 사실**만 붙인다: 마감 임박(모집중의 2%) · 사택 제공(40%). 그래서 배지 없는 카드가 절반이고,
// 그 자체가 구분이 된다. "새 공고"는 배지가 아니라 게시 시각의 색으로 말한다(`RelativeTime`의 `highlightWithinDays`) — 배지가 셋이면 카드가
// 다시 시끄러워진다(시안 검토 2026-09-06). 카드마다 색을 다르게 칠하지 않는다 — 정보 없는 장식은 이 사이트가 일관되게 뺀 방향.
// ⚠️ 날짜 판정은 **클라이언트**에서 한다(CLAUDE.md 'use cache' 제약 #5 — 프리렌더·캐시 안의 "오늘"은 굳는다).
//    그래서 `today`를 인자로 받고, 서버 렌더는 `null`을 넘겨 날짜 배지를 비운다.

export type JobBadge =
  { kind: "closed" } | { kind: "deadline"; label: string } | { kind: "housing" };

type BadgeInput = Pick<JobCard, "deadline" | "housingProvided" | "isPubliclyOpen">;

/** 두 ISO 날짜(YYYY-MM-DD)의 차이(일). `to`가 이르면 음수, 형식이 깨졌으면 NaN */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`);
  return Number.isNaN(ms) ? Number.NaN : Math.round(ms / 86_400_000);
}

/** 우선순위 순 — 마감 임박이 사택보다 먼저다(놓치면 되돌릴 수 없는 정보가 앞) */
export function jobBadges(job: BadgeInput, today: string | null): JobBadge[] {
  if (!job.isPubliclyOpen) return [{ kind: "closed" }];
  const badges: JobBadge[] = [];
  const left =
    today !== null && job.deadline !== null ? daysBetween(today, job.deadline) : Number.NaN;
  if (left >= 0 && left <= DEADLINE_SOON_DAYS) {
    badges.push({ kind: "deadline", label: left === 0 ? "D-day" : `D-${left}` });
  }
  if (job.housingProvided === true) badges.push({ kind: "housing" });
  return badges;
}
