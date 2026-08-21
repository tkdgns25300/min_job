"use client";

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DEDUP_STATES, REVIEW_STATUSES } from "@/constants/review";
import { enumLabel } from "@/lib/format";
import { toEdits } from "@/lib/review-edits";
import type { ReviewRow } from "@/lib/queries/review";
import { approveReview, rejectReview, type ReviewActionResult } from "../../actions";
import { contactSummary, groupDifferences } from "./group-diff";

// 묶음 판정 — 크롤러가 "같은 자리인지 내가 정할 수 없다"고 넘긴 건. 한 건씩 보면 판단이 안 되므로
// 묶음을 나란히 놓는다.
//
// ⚠️ **판정은 이 건(target)에만 쓴다.** 이미 공개된 구성원은 건드리지 않는다 — 내리는 일은
//    `jobs`를 쓰는 일이고 이 화면의 일이 아니다(SPEC).

export function GroupView({ members, target }: { members: ReviewRow[]; target: ReviewRow }) {
  const [note, setNote] = useState(target.row.review_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const differences = groupDifferences(members.map((m) => m.row));
  // 판정한 뒤 이 URL로 되돌아올 수 있다 — `dedup_state`는 그대로 `UNCERTAIN`이라 화면이 열린다.
  // 되돌리기는 단건 화면에 있다(판정 하나에 되돌리는 곳이 둘이면 어느 쪽이 정본인지 모른다).
  const processed = target.row.review_status !== "PENDING";

  const run = (action: () => Promise<ReviewActionResult>) => {
    setError(null);
    startTransition(async () => {
      try {
        // 두 판정 모두 성공하면 서버가 큐로 보낸다 — 여기 돌아오는 것은 실패뿐이다
        const result = await action();
        if (result && !result.ok) setError(result.message);
      } catch (thrown) {
        unstable_rethrow(thrown); // 리다이렉트 신호는 삼키지 않는다
        console.error("[review] 묶음 판정 실패", thrown);
        setError("처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <>
      <p className="rounded-xl border bg-muted/30 p-3 text-xs leading-relaxed break-keep text-muted-foreground">
        묶음 키 <code className="font-mono">{target.row.dedup_key}</code> — 크롤러가 매 실행 다시
        계산합니다. 여기서 고칠 수 없습니다.
      </p>

      <ol className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card">
        {members.map((member, index) => (
          <MemberRow
            key={member.row.id}
            member={member}
            index={index + 1}
            isTarget={member.row.id === target.row.id}
          />
        ))}
      </ol>

      <div className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
        <p className="text-sm font-bold">
          {differences.length > 0
            ? `다른 점 — ${differences.join(" · ")}`
            : "다른 점을 찾지 못했습니다"}
        </p>
        <p className="mt-1 text-xs leading-relaxed break-keep text-muted-foreground">
          {differences.length > 0
            ? "담당자가 여럿인지, 한 사람이 값을 바꿔 다시 올렸는지를 보고 정합니다."
            : "값이 같은데 크롤러가 확신하지 못한 건입니다 — 게시 시점과 원문을 비교해 주세요."}
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium">
            검수 메모
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              중복 처리할 때는 필수
            </span>
          </span>
          <Textarea
            rows={2}
            disabled={pending}
            placeholder="무엇을 보고 그렇게 판단했는지 — 중복 규칙을 고칠 때 이 기록이 근거가 됩니다"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {processed && (
          <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs font-semibold text-gold-ink">
            이미 판정한 건입니다 —{" "}
            <Link href={`/admin/review/${target.row.id}`} className="underline underline-offset-2">
              단건 검수
            </Link>
            에서 되돌릴 수 있습니다.
          </p>
        )}
        {error && (
          <p className="mt-3 text-xs font-semibold text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            variant="destructive"
            disabled={pending || processed}
            onClick={() => run(() => rejectReview(target.row.id, note))}
          >
            같은 자리 — 이 건을 중복 처리
          </Button>
          <Button
            className="flex-1"
            disabled={pending || processed || target.gaps.length > 0}
            onClick={() => run(() => approveReview(target.row.id, toEdits(target.row), note))}
          >
            다른 자리 — 이 건도 공개
          </Button>
        </div>
        <Link
          href={`/admin/review/${target.row.id}`}
          className="mt-2 block text-center text-xs font-semibold text-primary"
        >
          값도 고쳐야 하면 단건 검수로 →
        </Link>

        <p className="mt-3 text-xs leading-relaxed break-keep text-muted-foreground">
          둘 다 <b>이 건에만</b> 씁니다 — 이미 공개된 구성원은 건드리지 않습니다. “같은 자리”는 거절
          사유를 <b>운영자 판단</b>으로 남깁니다. 크롤러의 <b>중복</b> 사유로 쓰면 다음 실행이 자기
          판정으로 보고 되돌립니다.
          {target.gaps.length > 0 && (
            <b className="text-destructive">
              {" "}
              이 건은 빈 칸({target.gaps.join("·")})이 있어 그대로 공개할 수 없습니다 — 단건
              검수에서 채워 주세요.
            </b>
          )}
        </p>
      </div>
    </>
  );
}

function MemberRow({
  member,
  index,
  isTarget,
}: {
  member: ReviewRow;
  index: number;
  isTarget: boolean;
}) {
  const { row, source } = member;
  return (
    <li className={cn("flex flex-wrap gap-3 px-4 py-3 text-xs", isTarget && "bg-primary/5")}>
      <span className="w-5 shrink-0 font-bold tabular-nums text-muted-foreground">{index}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-all">{contactSummary(row)}</p>
        <p className="mt-0.5 text-muted-foreground">
          {/* `source_data.posted_on` — `review_data.posted_at`은 묶음의 최신 게시일로 덮인다(seam 주석) */}
          {[source.source_key, `${source.posted_on} 게시`, enumLabel(DEDUP_STATES, row.dedup_state)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {isTarget && <span className="font-bold text-primary">이 건 · </span>}
        <span className="text-muted-foreground">
          {enumLabel(REVIEW_STATUSES, row.review_status)}
        </span>
        {row.published_job_id && (
          <>
            <br />
            <Link
              href={`/jobs/${row.published_job_id}`}
              target="_blank"
              className="font-semibold text-primary underline underline-offset-2"
            >
              공개된 공고 보기 ↗
            </Link>
          </>
        )}
      </div>
    </li>
  );
}
