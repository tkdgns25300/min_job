"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { jobBadges, type JobBadge } from "@/lib/job-badges";
import { todayInSeoul } from "@/lib/job-visibility";
import { cn } from "@/lib/utils";
import type { JobCard } from "@/types/domain";

// 카드 배지 줄 — 규칙은 `lib/job-badges`, 여기는 그리기만. 카드 4종(격자·목록 로우·교회 페이지·저장 목록)이 쓴다.
// 마감 D-n은 "오늘"이 필요해서 마운트 뒤에 채운다(`RelativeTime`과 같은 이유 · CLAUDE.md 'use cache' 제약 #5) —
// 서버 HTML에는 사택·마감 배지만 실리고, D-n은 하이드레이션 뒤 더해진다(모집중의 2%라 흔들림이 드물다).
// 모양은 **하나**다 — 얇은 외곽선·작은 라운드·채움 없음. 색은 마감 임박에만 골드(브랜드 강조색), 사택은 딥그린,
// 마감은 무채색. 필터 칩(둥근 pill · 누르는 것)과 헷갈리지 않게 각을 살렸다(시안 검토 2026-09-06 — 채움·점선 배지는
// "싼마이"라는 운영자 판정).
const TONE: Record<JobBadge["kind"], string> = {
  deadline: "border-gold/70 text-gold-ink",
  housing: "border-primary/35 text-primary",
  closed: "text-muted-foreground",
};

function label(badge: JobBadge): string {
  if (badge.kind === "deadline") return badge.label;
  return badge.kind === "housing" ? "사택 제공" : "마감";
}

export function JobBadges({
  job,
  max = 2,
  className,
}: {
  job: Pick<JobCard, "deadline" | "housingProvided" | "isPubliclyOpen">;
  /** 한 카드에 보이는 최대 개수 — 폰 카드는 둘이면 충분하다 */
  max?: number;
  className?: string;
}) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(todayInSeoul());
  }, []);

  const badges = jobBadges(job, today).slice(0, max);
  if (badges.length === 0) return null;

  // span인 이유 — 목록 로우에서는 직분 줄(<p>) 안에 인라인으로 들어간다
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {badges.map((badge) => (
        <Badge
          key={badge.kind}
          variant="outline"
          className={cn(
            "h-auto rounded-md px-1.5 py-px text-[11px] font-semibold",
            TONE[badge.kind],
          )}
        >
          {label(badge)}
        </Badge>
      ))}
    </span>
  );
}
