"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { isPubliclyOpen } from "@/lib/job-visibility";
import { editsError, normalizeEdits, toEdits, type ReviewEdits } from "@/lib/review-edits";
import { PROMOTION_FIELDS, promotionGaps } from "@/lib/review-flags";
import type { ReviewDetail } from "@/lib/queries/review";
import {
  approveReview,
  rejectReview,
  saveReview,
  undoReview,
  type ReviewActionResult,
} from "../actions";
import { ReviewFields } from "./review-fields";

// 값을 고치고 판정하는 열. 판정 규칙의 정본은 서버(actions.ts)다 — 여기 계산은 **미리 보여주기** 위한 것이고
// 버튼을 잠그는 것도 편의다. 승인 게이트는 서버가 다시 판단한다.

export function ReviewForm({ detail, today }: { detail: ReviewDetail; today: string }) {
  const router = useRouter();
  const { row } = detail;
  const original = useMemo(() => toEdits(row), [row]);
  const [draft, setDraft] = useState<ReviewEdits>(original);
  const [note, setNote] = useState(row.review_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const patch = (partial: Partial<ReviewEdits>) => {
    setDraft((current) => ({ ...current, ...partial }));
    setDone(null);
  };

  // 화면이 보는 값과 서버가 저장하는 값이 같아야 게이트가 거짓말을 하지 않는다(같은 함수를 쓴다)
  const edits = normalizeEdits(draft);
  const gaps = promotionGaps(edits);
  const pairError = editsError(edits);
  const processed = row.review_status !== "PENDING";

  // 승인해도 목록에 안 뜨는 경우 — 마감일이 지났거나 상시모집이 90일을 넘겼다(job-visibility가 정본)
  const willShow = isPubliclyOpen(
    { status: "OPEN", deadline: edits.deadline, postedAt: row.posted_at },
    today,
  );

  const run = (action: () => Promise<ReviewActionResult>, success: string) => {
    setError(null);
    setDone(null);
    startTransition(async () => {
      try {
        const result = await action();
        // 승인·거절이 성공하면 서버가 큐로 보내므로 이 줄에 오지 않는다 — 저장·되돌리기는 온다.
        if (result && !result.ok) setError(result.message);
        else {
          setDone(success);
          router.refresh();
        }
      } catch (thrown) {
        // 리다이렉트 등 Next 제어 신호는 삼키지 않는다(login/actions.ts와 같은 관용구).
        unstable_rethrow(thrown);
        // 그 밖의 예외를 그냥 두면 에러 바운더리가 떠서 **고치던 값이 통째로 날아간다.**
        console.error("[review] 판정 실패", thrown);
        setError("처리하지 못했습니다. 고친 값은 그대로 있으니 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-bold">구조화된 값</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        왼쪽 원문과 대조해 고칩니다. 승인해도 지금 공개되지는 않습니다 — 공개는 크롤러의 다음 실행이
        합니다.
      </p>

      {processed && (
        <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs font-semibold text-gold-ink">
          이미 처리된 항목입니다 — 되돌린 뒤에 고칠 수 있습니다.
        </p>
      )}

      {/* fieldset 하나로 하위 컨트롤 전체가 잠긴다 — 칸마다 disabled를 붙이면 새 칸에서 잊는다 */}
      <fieldset disabled={processed || pending} className="mt-4 disabled:opacity-60">
        <ReviewFields draft={draft} patch={patch} original={original} />
      </fieldset>

      <PromotionGate gaps={gaps} />

      <div className="mt-4 border-t pt-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            검수 메모
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              거절할 때는 필수
            </span>
          </span>
          <Textarea
            rows={2}
            // 처리된 건에서는 저장할 경로가 없다 — 열어 두면 적어 놓고 사라지는 칸이 된다
            disabled={pending || processed}
            placeholder="판단 근거를 남겨 주세요 — 규칙을 고칠 때 이 기록이 근거가 됩니다"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {error && (
          <p className="mt-3 text-xs font-semibold text-destructive" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="mt-3 text-xs font-semibold text-primary" role="status">
            {done}
          </p>
        )}

        {processed ? (
          <Button
            className="mt-3 w-full"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => undoReview(row.id), "검수 대기로 되돌렸습니다.")}
          >
            되돌리기 (검수 대기로)
          </Button>
        ) : (
          <>
            <div className="mt-3 flex gap-2">
              <Button
                className="flex-1"
                variant="destructive"
                disabled={pending}
                onClick={() => run(() => rejectReview(row.id, note), "거절했습니다.")}
              >
                거절
              </Button>
              <Button
                className="flex-1"
                disabled={pending || gaps.length > 0 || pairError !== null}
                onClick={() => run(() => approveReview(row.id, draft, note), "승인했습니다.")}
              >
                승인
              </Button>
            </div>
            <Button
              className="mt-2 w-full"
              variant="outline"
              disabled={pending || pairError !== null}
              onClick={() => run(() => saveReview(row.id, draft, note), "저장했습니다.")}
            >
              저장만 (검수 대기 유지)
            </Button>
            <FooterNote gaps={gaps} pairError={pairError} willShow={willShow} />
          </>
        )}
      </div>
    </section>
  );
}

/** 승격 필수 6칸 — 여섯을 **다** 그린다. 없는 것만 보여주면 무엇을 다 봤는지 알 수 없다 */
function PromotionGate({ gaps }: { gaps: readonly string[] }) {
  return (
    <div className="mt-4 rounded-xl border bg-muted/30 p-3">
      <p className="text-[11px] font-bold tracking-wide text-muted-foreground">
        승격 필수 6칸 — 비면 크롤러의 공개가 CHECK로 막힙니다
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {PROMOTION_FIELDS.map((field) => {
          const filled = !gaps.includes(field);
          return (
            <li
              key={field}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                filled
                  ? "border-primary/25 bg-primary/8 text-primary"
                  : "border-destructive/25 bg-destructive/8 text-destructive",
              )}
            >
              {filled ? "✓" : "✕"} {field}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 버튼 아래 한 줄 — 왜 막혔는지, 승인하면 무슨 일이 일어나는지 */
function FooterNote({
  gaps,
  pairError,
  willShow,
}: {
  gaps: readonly string[];
  pairError: string | null;
  willShow: boolean;
}) {
  if (pairError) {
    return (
      <p className="mt-2 text-xs font-semibold break-keep text-destructive" role="alert">
        {pairError}
      </p>
    );
  }
  if (gaps.length > 0) {
    return (
      <p className="mt-2 text-xs font-semibold break-keep text-destructive">
        빈 칸 {gaps.length}개를 채우거나, 사유를 적고 거절해 주세요.
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs leading-relaxed break-keep text-muted-foreground">
      {!willShow && (
        <b className="text-destructive">
          승인해도 목록에 뜨지 않습니다 — 마감일이 지났거나 상시모집이 90일을 넘겼습니다.{" "}
        </b>
      )}
      승인하면 <b>다음 수집 실행에</b> 공개됩니다 — 즉시 목록에 뜨지 않고, 그 전까지는 되돌릴 수
      있습니다. 거절은 고친 값을 저장하지 않습니다(공개되지 않으므로).
    </p>
  );
}
