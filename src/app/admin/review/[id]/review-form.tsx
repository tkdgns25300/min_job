"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { isPubliclyOpen } from "@/lib/job-visibility";
import {
  changedEdits,
  editsError,
  normalizeEdits,
  toEdits,
  type ReviewEdits,
} from "@/lib/review-edits";
import { promotionGaps } from "@/lib/review-flags";
import type { Tables } from "@/types/database";
import { approveReview, rejectReview, undoReview, type ReviewActionResult } from "../actions";
import { PublicPreview } from "./public-preview";
import { ValueList } from "./value-list";
import { ROW_COUNT, type Checks, type RowKey } from "./value-rows";

// 값을 고치고 판정하는 열. 판정 규칙의 정본은 서버(actions.ts)다 — 여기 계산은 **미리 보여주기** 위한
// 것이고 버튼을 잠그는 것도 편의다. 승인 게이트는 서버가 다시 판단한다.

type Tab = "values" | "preview";

// ⚠️ `ReviewDetail`이 아니라 **`row`만** 받는다. 이 컴포넌트는 클라이언트라 받은 prop이 전부
// 페이지 payload로 직렬화되는데, `detail`에는 원문 본문(`source.raw_text`, 수 KB)과 포스터
// signed URL이 들려 있고 여기서 쓰지 않는다 — 원문 열은 서버에서 그린다.
export function ReviewForm({ row, today }: { row: Tables<"review_data">; today: string }) {
  const router = useRouter();
  const original = useMemo(() => toEdits(row), [row]);
  const [draft, setDraft] = useState<ReviewEdits>(original);
  const [note, setNote] = useState(row.review_note ?? "");
  const [tab, setTab] = useState<Tab>("values");
  // 확인 표시는 **값 하나씩**이다(묶음 단위였던 것을 내렸다 · 운영자 결정 2026-08-23).
  // 저장하지 않는다 — 한 건을 보는 동안 어디까지 봤는지 기억하는 용도다.
  const [checked, setChecked] = useState<ReadonlySet<RowKey>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const patch = (partial: Partial<ReviewEdits>) => {
    setDraft((current) => ({ ...current, ...partial }));
    setDone(null);
  };

  // 화면이 보는 값과 서버가 저장하는 값이 같아야 게이트가 거짓말을 하지 않는다(같은 함수를 쓴다)
  const edits = normalizeEdits(draft);
  const changed = changedEdits(edits, original);
  const gaps = promotionGaps(edits);
  const pairError = editsError(edits);
  const processed = row.review_status !== "PENDING";
  const checks: Checks = {
    has: (name) => checked.has(name),
    toggle: (name) =>
      setChecked((current) => {
        const next = new Set(current);
        if (!next.delete(name)) next.add(name);
        return next;
      }),
  };

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
        // 승인·거절이 성공하면 서버가 큐로 보내므로 이 줄에 오지 않는다 — 되돌리기만 온다.
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
    <section className="flex min-h-0 flex-col">
      <div className="flex items-center gap-1.5">
        <TabButton active={tab === "values"} onClick={() => setTab("values")}>
          값 검수
          <span className="ml-1.5 tabular-nums">
            {checked.size}/{ROW_COUNT}
          </span>
        </TabButton>
        <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
          공개 미리보기
        </TabButton>
        {Object.keys(changed).length > 0 && (
          <span className="ml-auto text-xs font-semibold text-primary">
            고친 칸 {Object.keys(changed).length}개
          </span>
        )}
      </div>

      {processed && (
        <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs font-semibold text-gold-ink">
          이미 처리된 항목입니다 — 되돌린 뒤에 고칠 수 있습니다.
        </p>
      )}

      <div className="mt-3">
        {tab === "values" ? (
          /* fieldset 하나로 하위 컨트롤 전체가 잠긴다 — 칸마다 disabled를 붙이면 새 칸에서 잊는다 */
          <fieldset disabled={processed || pending} className="disabled:opacity-60">
            <ValueList
              draft={draft}
              original={original}
              changed={changed}
              patch={patch}
              row={row}
              editable={!processed}
              checks={checks}
            />
          </fieldset>
        ) : (
          <PublicPreview draft={edits} row={row} willShow={willShow} />
        )}
      </div>

      {/* 판정 바 — 값이 길어 스크롤이 생기므로 버튼이 늘 손에 닿아야 한다.
          `sticky`는 스크롤 컨테이너(page.tsx의 열) 안에서 붙는다 */}
      <div className="sticky bottom-0 mt-4 border-t bg-card/95 pt-3 pb-1 backdrop-blur">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">
            검수 메모
            <span className="ml-1.5 font-normal text-muted-foreground">거절할 때는 필수</span>
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
          <p className="mt-2 text-xs font-semibold text-destructive" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="mt-2 text-xs font-semibold text-primary" role="status">
            {done}
          </p>
        )}

        {processed ? (
          <Button
            className="mt-2 w-full"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => undoReview(row.id), "검수 대기로 되돌렸습니다.")}
          >
            되돌리기 (검수 대기로)
          </Button>
        ) : (
          <>
            {/* 판정은 둘뿐이다 — "저장만"은 없앴다(2026-08-23): 승인·거절이 이미 `reviewed_by`를
                찍으므로 표시에 구멍이 없고, 판정하지 않은 행에 도장이 찍히면 크롤러의 재구조화가
                그 행을 건너뛰어 **반쯤 고친 초안이 굳는다** */}
            <div className="mt-2 flex gap-2">
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
            <Gate
              gaps={gaps}
              pairError={pairError}
              willShow={willShow}
              unchecked={ROW_COUNT - checked.size}
            />
          </>
        )}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-xs font-semibold",
        active ? "border-primary bg-primary/8 text-primary" : "text-muted-foreground",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

/**
 * 버튼 아래 한 줄 — 왜 막혔는지, 승인하면 무슨 일이 일어나는지. **문장 하나**만 낸다:
 * 여러 줄을 쌓으면 읽지 않게 되고, 그러면 막힌 이유를 모른 채 버튼을 누른다.
 *
 * ⚠️ 확인 표시는 **막지 않는다** — 새로고침하면 사라지는 화면 상태로 판정을 막으면
 *    되돌리기 한 번에 일이 두 번 된다. 남은 수를 말해 주는 것까지가 이 값의 역할이다.
 */
function Gate({
  gaps,
  pairError,
  willShow,
  unchecked,
}: {
  gaps: readonly string[];
  pairError: string | null;
  willShow: boolean;
  unchecked: number;
}) {
  if (pairError) {
    return (
      <p className="mt-2 text-xs font-semibold break-keep text-destructive" role="alert">
        {pairError}
      </p>
    );
  }
  if (gaps.length > 0) {
    // 문장을 `{칸}이 비어…`로 쓰면 조사가 틀어진다("연락처이") — 서버 메시지와 같은 어순으로 둔다
    return (
      <p className="mt-2 text-xs font-semibold break-keep text-destructive">
        빈 칸이 있어 승인할 수 없습니다 — {gaps.join("·")}. 채우거나, 사유를 적고 거절해 주세요.
      </p>
    );
  }
  if (!willShow) {
    return (
      <p className="mt-2 text-xs font-semibold break-keep text-destructive">
        승인해도 목록에 뜨지 않습니다 — 마감일이 지났거나 상시모집이 90일을 넘겼습니다.
      </p>
    );
  }
  if (unchecked > 0) {
    return (
      <p className="mt-2 text-xs break-keep text-muted-foreground">
        확인 표시를 안 한 값이 {unchecked}개 있습니다. 승인하면 다음 수집 실행에 공개됩니다.
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs break-keep text-muted-foreground">
      승인하면 <b>다음 수집 실행에</b> 공개됩니다 — 그전까지는 되돌릴 수 있습니다.
    </p>
  );
}
