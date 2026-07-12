import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, EMPLOYMENT_TYPES, FEATURED_TIERS, JOB_STATUSES, POSITIONS } from "@/constants/domain";
import type { JobStatus } from "@/types/domain";
import type { MyJob } from "@/lib/queries/users";

// 상태 배지 위계 — 모집중=default(초록 면), 마감=secondary, 검수중=outline (SPEC /mypage)
const STATUS_BADGE_VARIANT: Record<JobStatus, "default" | "secondary" | "outline"> = {
  OPEN: "default",
  CLOSED: "secondary",
  PENDING: "outline",
};

// 마이페이지 관리 행 — JobRow와 달리 전면 클릭 링크가 아니라 액션이 주인공.
// 액션은 상태별로: 마감건은 복사(재등록)만, 그 외는 수정·(마감)·복사·삭제. 모바일에선 액션이 아래로 wrap.
export function MyJobRow({ job }: { job: MyJob }) {
  const isClosed = job.status === "CLOSED";
  const roleLine = [POSITIONS[job.position], job.department && DEPARTMENTS[job.department], EMPLOYMENT_TYPES[job.employmentType]]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/jobs/${job.id}`} className="truncate font-bold tracking-tight hover:underline">
            {job.title}
          </Link>
          <Badge variant={STATUS_BADGE_VARIANT[job.status]} className="shrink-0">
            {JOB_STATUSES[job.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{roleLine}</p>
        {/* 노출 등급 = 텍스트 라벨(정보, 장식 아님 — 틴트·색 배지 금지). 일반은 표시 안 함 */}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {job.featuredTier !== "NONE" && `${FEATURED_TIERS[job.featuredTier]} 노출 · `}
          {job.postedAt} 게시 · {job.deadline ? `${job.deadline} 마감` : "상시모집"}
        </p>
        {job.status === "PENDING" && (
          <p className="mt-1 text-xs text-muted-foreground">검수 중이에요 — 확인이 끝나면 곧 게재돼요.</p>
        )}
      </div>

      {/* 마감·삭제·복사는 Phase 1 Server Action에서 배선(삭제·마감은 확인 다이얼로그 필수) — mock 단계 비활성 */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {!isClosed && (
          <Link
            href={`/jobs/${job.id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            수정
          </Link>
        )}
        {job.status === "OPEN" && (
          <Button variant="ghost" size="sm" disabled>
            마감
          </Button>
        )}
        <Button variant="ghost" size="sm" disabled>
          복사
        </Button>
        {!isClosed && (
          <Button variant="ghost" size="sm" disabled className="text-destructive">
            삭제
          </Button>
        )}
      </div>
    </div>
  );
}
