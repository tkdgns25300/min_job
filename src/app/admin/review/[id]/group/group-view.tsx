"use client";

import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { boardLabel } from "@/constants/review";
import { toEdits } from "@/lib/review-edits";
import type { ReviewRow } from "@/lib/queries/review";
import { approveReview, rejectReview, type ReviewActionResult } from "../../actions";
import { groupDifferences, type GroupDifference } from "./group-diff";

// 판정이 끝나면 돌아가는 곳 — 단건 화면과 같은 이유로 화면 쪽에 둔다(`review-form` 주석 참조).
const QUEUE_PATH = "/admin/review";

// 묶음 판정 — 크롤러가 "같은 자리인지 내가 정할 수 없다"고 넘긴 건. 한 건씩 보면 판단이 안 되므로
// 묶음을 나란히 놓는다.
//
// ⚠️ **판정은 이 건(target)에만 쓴다.** 이미 공개된 구성원은 건드리지 않는다 — 내리는 일은
//    `jobs`를 쓰는 일이고 이 화면의 일이 아니다(SPEC).

export function GroupView({ members, target }: { members: ReviewRow[]; target: ReviewRow }) {
  const [note, setNote] = useState(target.row.review_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const differences = groupDifferences(members.map((m) => m.row));
  // 판정한 뒤 이 URL로 되돌아올 수 있다 — `dedup_state`는 그대로 `UNCERTAIN`이라 화면이 열린다.
  // 되돌리기는 단건 화면에 있다(판정 하나에 되돌리는 곳이 둘이면 어느 쪽이 정본인지 모른다).
  const processed = target.row.review_status !== "PENDING";

  const run = (action: () => Promise<ReviewActionResult>, success: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result && !result.ok) setError(result.message);
        else {
          // ⚠️ **어느 쪽을 눌렀는지 말해 주는 것이 핵심**이다 — 두 버튼은 뜻이 정반대인데
          //    판정이 끝나면 둘 다 큐로 돌아가 "그 줄이 사라졌다"만 남는다.
          // ⚠️ **먼저 알리고 나서** 보낸다 — 액션이 `redirect`하면 이 줄에 오지 못한다(실측).
          toast.success(success);
          router.push(QUEUE_PATH);
        }
      } catch (thrown) {
        unstable_rethrow(thrown); // 리다이렉트 신호는 삼키지 않는다
        console.error("[review] 묶음 판정 실패", thrown);
        setError("처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <>
      {/* 묶음 키·묶인 이유를 적던 상자는 없앴다(2026-08-23) — 갈리는 값이 아래에 건별로 다 나와
          있어 같은 말을 두 번 하고, 키(`교회명:지역:직분:부서:R1`)는 읽을 사람이 없다 */}
      <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
        {members.map((member, index) => (
          <MemberRow
            key={member.row.id}
            member={member}
            index={index + 1}
            isTarget={member.row.id === target.row.id}
            differences={differences}
            at={index}
          />
        ))}
      </ol>

      <div className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
        <p className="text-sm font-bold">이 건을 어떻게 할까요</p>
        <p className="mt-1 text-xs leading-relaxed break-keep text-muted-foreground">
          담당자가 여럿이어서 자리가 여럿인지, 한 사람이 값을 바꿔 <b>같은 자리를 다시 올렸는지</b>
          를 보고 정합니다. 게시일이 며칠 간격이고 접수 경로만 바뀌었다면 다시 올린 것입니다.
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
            // 판정한 건에서는 저장할 경로가 없다 — 열어 두면 적어 놓고 사라지는 칸이 된다(단건과 같다)
            disabled={pending || processed}
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
            onClick={() => run(() => rejectReview(target.row.id, note), "중복 처리했습니다.")}
          >
            같은 자리 — 이 건을 중복 처리
          </Button>
          <Button
            className="flex-1"
            disabled={pending || processed || target.gaps.length > 0}
            onClick={() =>
              run(
                () => approveReview(target.row.id, toEdits(target.row), note),
                "공개 대기로 승인했습니다.",
              )
            }
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

/**
 * 구성원 한 줄 — **제목이 첫 줄**이다. 접수 이메일을 앞세우면(이전 모양) 사람이 알아볼 수 없는
 * 문자열이 주인공이 되고, 정작 "같은 글을 다시 올린 것인가"를 판단할 재료가 안 보인다.
 * 갈리는 값은 **이 건의 값만** 뽑아 라벨과 함께 붙인다 — 표를 좌우로 훑지 않고 세로로 읽으면 된다.
 */
function MemberRow({
  member,
  index,
  isTarget,
  differences,
  at,
}: {
  member: ReviewRow;
  index: number;
  isTarget: boolean;
  differences: GroupDifference[];
  /** 이 구성원이 묶음에서 몇 번째인가 — `differences[].values`의 첨자 */
  at: number;
}) {
  const { row, source } = member;
  return (
    <li className={cn("flex gap-3 px-4 py-3 text-xs", isTarget && "bg-primary/5")}>
      <span className="w-4 shrink-0 pt-0.5 font-bold tabular-nums text-muted-foreground">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-keep">{row.title ?? "제목 없음"}</p>
        {/* `source_data.posted_on` — `review_data.posted_at`은 묶음의 최신 게시일로 덮인다(seam 주석) */}
        <p className="mt-0.5 text-muted-foreground">
          {boardLabel(source.source_key)} · {source.posted_on} 게시
        </p>
        {differences.length > 0 && (
          <dl className="mt-1.5 space-y-0.5">
            {differences.map(({ label, values }) => (
              <div key={label} className="flex gap-2">
                <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
                <dd className="min-w-0 flex-1 break-all">
                  {values[at] || <span className="text-muted-foreground">없음</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="w-20 shrink-0 text-right">
        <p className={cn("font-bold", isTarget ? "text-primary" : "text-muted-foreground")}>
          {memberState(member, isTarget)}
        </p>
        {row.published_job_id && (
          <Link
            href={`/jobs/${row.published_job_id}`}
            target="_blank"
            className="font-semibold text-primary underline underline-offset-2"
          >
            공고 보기 ↗
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * 이 구성원이 지금 어떤 상태인가. `dedup_state`는 쓰지 않는다 — 묶음 전원이 `UNCERTAIN`이라
 * 줄마다 같은 말이 반복되기만 한다(이 화면 자체가 그 뜻이다).
 */
function memberState({ row }: ReviewRow, isTarget: boolean): string {
  if (isTarget) return "판정 대상";
  if (row.published_job_id) return "공개됨";
  if (row.review_status === "REJECTED") return "거절됨";
  if (row.review_status === "APPROVED") return "공개 대기";
  return "검수 대기";
}
