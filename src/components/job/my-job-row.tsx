import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURED_TIERS, JOB_STATUSES } from "@/constants/domain";
import type { JobStatus } from "@/types/domain";
import type { MyJob } from "@/lib/queries/users";

// 상태 배지 위계 — 모집중=default(초록 면), 마감=secondary, 검수중=outline (fable.md /mypage)
const STATUS_BADGE_VARIANT: Record<JobStatus, "default" | "secondary" | "outline"> = {
  OPEN: "default",
  CLOSED: "secondary",
  PENDING: "outline",
};

// 마이페이지 관리 행 — JobRow와 달리 전면 클릭 링크가 아니라 액션이 주인공.
// 모바일에선 액션이 행 아래로 wrap (모바일 퍼스트).
export function MyJobRow({ job }: { job: MyJob }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/jobs/${job.id}`}
            className="truncate font-bold tracking-tight hover:underline"
          >
            {job.title}
          </Link>
          <Badge variant={STATUS_BADGE_VARIANT[job.status]} className="shrink-0">
            {JOB_STATUSES[job.status]}
          </Badge>
        </div>
        {/* 노출 등급은 텍스트 라벨 — 결제 상태의 가시화(정보), 장식 아님 */}
        <p className="mt-1 text-sm text-muted-foreground">
          {FEATURED_TIERS[job.featuredTier]} 노출 · {job.postedAt} 게시 ·{" "}
          {job.deadline ? `${job.deadline} 마감` : "상시모집"}
        </p>
        {job.status === "PENDING" && (
          <p className="mt-1 text-xs text-muted-foreground">
            검수 중이에요 — 확인이 끝나면 곧 게재돼요.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href={`/jobs/${job.id}/edit`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          수정
        </Link>
        {/* 마감·삭제는 Phase 1 Server Action에서 배선(삭제는 확인 다이얼로그 필수) — mock 단계 비활성 */}
        {job.status === "OPEN" && (
          <Button variant="ghost" size="sm" disabled>
            마감
          </Button>
        )}
        <Button variant="ghost" size="sm" disabled className="text-destructive">
          삭제
        </Button>
      </div>
    </div>
  );
}
