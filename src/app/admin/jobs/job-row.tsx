"use client";

import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { FEATURED_TIERS, JOB_SOURCES, JOB_STATUSES } from "@/constants/domain";
import { jobRoleLine } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminJob, JobStatus } from "@/types/domain";
import { closeJob, reopenJob, type JobActionResult } from "./actions";

// 공고 관리 표의 한 줄. 판정·전환을 줄이 스스로 들고 있다 — 목록 하나에 상태를 모으면 어느 줄이
// 처리 중인지 알 수 없고, 한 줄의 실패가 표 전체를 덮는다(CLAUDE.md: 인터랙션 단위를 작게).
//
// ⛔ **삭제는 없다.** 지우면 크롤러가 "공개된 job이 사라졌다"를 감지해 다시 공개한다
//    (크롤러 SPEC §4.3). 내리는 수단은 마감이고, 되돌리는 것은 다시 모집이다.
// ⛔ **노출 설정도 없다.** 결제 경로가 아직 아무도 도달할 수 없어(교회 인증 미배선) 지금은 누를
//    수 있는데 아무 일도 안 하는 버튼이 된다. 등급 표시는 남긴다(값을 보는 것은 필요하다).

const STATUS_VARIANT: Record<JobStatus, "default" | "secondary"> = {
  OPEN: "default",
  CLOSED: "secondary",
};

// status가 OPEN인데 공개 목록에서 내려간 경우 — "게재중"으로 뭉뚱그리면 운영자가
// 자기 사이트에서 뭐가 안 보이는지 알 수 없다 (DATA §6-1). 판정은 lib/job-visibility.
const HIDDEN_LABEL: Record<"deadline" | "stale", string> = {
  deadline: "기간 지남",
  stale: "오래됨",
};

export function JobRow({ job }: { job: AdminJob }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<JobActionResult>) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        // 액션 응답에는 새 트리가 없다 — 목록을 다시 읽어야 상태가 바뀐다
        if (result.ok) router.refresh();
        else setError(result.message);
      } catch (thrown) {
        unstable_rethrow(thrown); // 리다이렉트 등 Next 제어 신호는 삼키지 않는다
        console.error("[admin/jobs] 처리 실패", thrown);
        setError("처리하지 못했습니다.");
      }
    });
  };

  const closed = job.status === "CLOSED";

  return (
    <tr>
      <td className="px-4 py-3 align-middle">
        <Link href={`/jobs/${job.id}`} className="font-semibold hover:underline">
          {job.title}
        </Link>
        <div className="mt-0.5 text-xs text-muted-foreground">{jobRoleLine(job)}</div>
        {error && (
          <p className="mt-1 text-xs font-semibold text-destructive" role="alert">
            {error}
          </p>
        )}
      </td>
      <td className="px-4 py-3 align-middle whitespace-nowrap">{job.church.name}</td>
      <td className="px-4 py-3 align-middle">
        {job.hiddenReason ? (
          <Badge variant="outline" title="공개 목록에서 내려갔어요">
            {HIDDEN_LABEL[job.hiddenReason]}
          </Badge>
        ) : (
          <Badge variant={STATUS_VARIANT[job.status]}>{JOB_STATUSES[job.status]}</Badge>
        )}
      </td>
      <td className="px-4 py-3 align-middle whitespace-nowrap">
        {job.featuredTier === "NONE" ? (
          <span className="text-xs text-muted-foreground">일반</span>
        ) : (
          <span className="text-xs font-semibold text-gold-ink">
            {FEATURED_TIERS[job.featuredTier]}
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-middle text-xs whitespace-nowrap text-muted-foreground">
        {JOB_SOURCES[job.source]}
      </td>
      <td className="px-4 py-3 align-middle text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {job.postedAt}
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center justify-end gap-1.5">
          <Link
            href={`/admin/jobs/${job.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            수정
          </Link>
          {closed ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => reopenJob(job.id))}
            >
              다시 모집
            </Button>
          ) : (
            /* 한 번 더 묻는다 — 표에서 잘못 누르기 쉽고, 누르는 순간 방문자에게서 사라진다.
               좁은 칸이라 설명 줄(`hint`)은 넘기지 않는다 — 버튼이 자리를 지키며 말과 색만 바꾼다 */
            <ConfirmButton
              label="마감"
              confirmLabel="마감 확인"
              size="sm"
              disabled={pending}
              onConfirm={() => run(() => closeJob(job.id))}
            />
          )}
        </div>
      </td>
    </tr>
  );
}
