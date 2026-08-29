import { jobRoleLine } from "@/lib/format";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURED_TIERS, JOB_STATUSES, ALWAYS_OPEN_MAX_DAYS } from "@/constants/domain";
import type { JobStatus } from "@/types/domain";
import type { MyJob } from "@/lib/queries/users";

// 상태 배지 위계 — 모집중=default(초록 면), 마감=secondary
const STATUS_BADGE_VARIANT: Record<JobStatus, "default" | "secondary"> = {
  OPEN: "default",
  CLOSED: "secondary",
};

// 마이페이지 관리 행 — 액션은 **`수정` 하나**다.
// ⛔ "조회 · 북마크 [집계 준비 중]" 배지는 뺐다(2026-08-28) — 조회수는 소스가 없고, 북마크 수는 RLS를 켤 때
//    남의 북마크를 세는 정책이 따로 필요해 그때 함께 넣는다. 안 만든 기능의 자리는 두지 않는다.
//
// ⛔ **`⋯` 오버플로우 메뉴를 걷어냈다**(2026-08-27). 안에 있던 `마감`·`삭제`·`재등록`이 전부
//    문제였다:
//    · `마감`·`삭제` — `onClick`이 메뉴를 닫기만 했다. **누를 수 있는데 아무 일도 안 하는
//      버튼**이라 `/admin/jobs`에서 같은 이유로 걷어낸 것들과 같은 부류다(SPEC).
//    · `삭제` — 애초에 **안 만들기로 결정한 기능**이다(마감하면 이력이 남고 지우면 그 교회가
//      언제 무엇을 뽑았는지가 사라진다 · `(authed)/jobs/actions.ts`).
//    · `재등록` — 빈 `/jobs/new`로 보냈다. 수정 화면의 **"다시 모집"** 이 같은 공고를 그대로
//      다시 여는 진짜 동작이라 두 화면이 다른 말을 하고 있었다.
//    상태 변경은 전부 `/jobs/[id]/edit` 하단 **상태 관리**가 한다(실동작 확인 2026-08-27).
// ⚠️ 분기도 `PENDING`이 있던 시절 모양이었다 — `JOB_STATUSES`는 `OPEN`·`CLOSED` 둘뿐이라
//    "검수중은 삭제만" 가지는 **도달할 수 없는 코드**였다(2026-08-21에 상태가 둘로 줄었다).
// 공개 목록에서 내려간 이유별 안내 — 판정은 lib/job-visibility, 여기는 문구만(도메인 로직 X)
const HIDDEN_NOTICE: Record<"deadline" | "stale", string> = {
  deadline: "마감일이 지나 목록에서 내려갔어요 — 마감일을 늘리면 다시 노출돼요.",
  stale: `게시 후 ${ALWAYS_OPEN_MAX_DAYS}일이 지나 목록에서 내려갔어요 — 갱신하면 다시 노출돼요.`,
};

export function MyJobRow({ job }: { job: MyJob }) {
  const isClosed = job.status === "CLOSED";
  const hidden = job.hiddenReason;
  const roleLine = jobRoleLine(job);

  return (
    <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
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
        <p className="mt-1 text-sm text-muted-foreground">{roleLine}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {/* 노출 등급 = 텍스트 라벨(정보). 일반은 표시 안 함. 만료일은 Phase 1 */}
          {job.featuredTier !== "NONE" && (
            <span className="font-semibold text-gold-ink">
              {FEATURED_TIERS[job.featuredTier]} 노출 ·{" "}
            </span>
          )}
          {job.postedAt} 게시 · {job.deadline ? `${job.deadline} 마감` : "상시모집"}
        </p>
        {/* 게재중인데 공개 목록에 안 보이는 경우 — 왜 안 보이는지 교회가 알아야 한다(DATA §6-1).
            status는 OPEN이라 배지만으로는 알 수 없어 별도 안내가 필요하다. */}
        {hidden && (
          <p className="mt-1.5 text-xs font-semibold text-gold-ink">{HIDDEN_NOTICE[hidden]}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* 마감된 공고도 같은 곳으로 — 그 화면 하단에서 "다시 모집"을 누른다 */}
        <Link
          href={`/jobs/${job.id}/edit`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {isClosed ? "수정 · 다시 모집" : "수정"}
        </Link>
      </div>
    </div>
  );
}
