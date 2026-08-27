"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import {
  changedJobEdits,
  jobEditsError,
  normalizeJobEdits,
  toJobEdits,
  type JobEdits,
} from "@/lib/job-edits";
import { isPubliclyOpen } from "@/lib/job-visibility";
import type { Tables } from "@/types/database";
import { closeJob, reopenJob, saveJob, type JobActionResult } from "../actions";
import { JobValueList } from "./job-value-list";

// 공개된 공고를 고치고 내리는 열. 규칙의 정본은 서버(actions.ts)다 — 여기 계산은 **미리 보여주기**
// 위한 것이고 버튼을 잠그는 것도 편의다.
//
// ⚠️ `row`만 받는다(도메인 타입이 아니라 DB 행) — 편집은 컬럼에 그대로 UPDATE를 걸기 때문이다.

export function JobEditForm({ row, today }: { row: Tables<"jobs">; today: string }) {
  const router = useRouter();
  const original = useMemo(() => toJobEdits(row), [row]);
  const [draft, setDraft] = useState<JobEdits>(original);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const patch = (partial: Partial<JobEdits>) => {
    setDraft((current) => ({ ...current, ...partial }));
  };

  // 화면이 보는 값과 서버가 저장하는 값이 같아야 막힌 이유가 거짓말을 하지 않는다(같은 함수를 쓴다)
  const edits = normalizeJobEdits(draft);
  const changed = changedJobEdits(edits, original);
  const invalid = jobEditsError(edits);
  const closed = row.status === "CLOSED";
  const changedCount = Object.keys(changed).length;

  // 마감이 아닌데도 목록에 안 뜨는 경우 — 마감일이 지났거나 상시모집이 90일을 넘겼다
  const visible = isPubliclyOpen(
    {
      status: row.status === "CLOSED" ? "CLOSED" : "OPEN",
      deadline: edits.deadline,
      postedAt: row.posted_at,
    },
    today,
  );

  const run = (action: () => Promise<JobActionResult>, success: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(result.message);
        else {
          // ⚠️ 성공은 **토스트**로 말한다 — 이 바가 `sticky bottom-0`이라 인라인 문구를 여기 두면
          //    버튼이 밀리고, 값이 길어 스크롤한 상태에서는 보이지도 않았다.
          //    실패는 인라인으로 남긴다 — 운영자가 읽고 조치해야 하는 말이다.
          toast.success(success);
          // 액션 응답에는 새 트리가 없다 — 이 화면의 값·상태를 다시 읽어야 반영된다
          router.refresh();
        }
      } catch (thrown) {
        unstable_rethrow(thrown); // 리다이렉트 등 Next 제어 신호는 삼키지 않는다
        // 그냥 두면 에러 바운더리가 떠서 **고치던 값이 통째로 날아간다**
        console.error("[admin/jobs] 처리 실패", thrown);
        setError("처리하지 못했습니다. 고친 값은 그대로 있으니 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <section>
      {/* 상태는 목록과 같은 시각 문법(Badge)으로 — 두 화면을 오갈 때 같은 것을 같게 읽어야 한다 */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={closed ? "secondary" : "default"}>{closed ? "마감" : "모집중"}</Badge>
        {closed && (
          <span className="text-xs text-muted-foreground">목록·검색에서 빠져 있습니다</span>
        )}
        {!closed && !visible && (
          <Badge variant="outline" title="공개 목록에서 내려갔어요">
            목록에 안 뜸 — 마감일 지남 또는 90일 초과
          </Badge>
        )}
        {changedCount > 0 && (
          <span className="ml-auto text-xs font-semibold text-primary">
            고친 칸 {changedCount}개
          </span>
        )}
      </div>

      <div className="mt-4">
        <JobValueList draft={draft} patch={patch} changed={changed} postedAt={row.posted_at} />
      </div>

      {/* 저장·마감 바 — 값이 길어 스크롤이 생기므로 버튼이 늘 손에 닿아야 한다 */}
      <div className="sticky bottom-0 mt-4 border-t bg-background/95 pt-3 pb-2 backdrop-blur">
        {error && (
          <p className="mb-2 text-xs font-semibold text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1"
            disabled={pending || changedCount === 0 || invalid !== null}
            onClick={() => run(() => saveJob(row.id, draft), "저장했습니다.")}
          >
            저장
          </Button>
          {closed ? (
            <Button
              className="flex-1"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => reopenJob(row.id), "다시 모집으로 바꿨습니다.")}
            >
              다시 모집
            </Button>
          ) : (
            /* 내리는 동작은 한 번 더 묻는다 — 되돌릴 수는 있지만 그동안 방문자에게 안 보인다 */
            <ConfirmButton
              className="flex-1"
              label="마감"
              confirmLabel="마감 확인"
              hint="목록·검색에서 빠집니다."
              disabled={pending}
              onConfirm={() => run(() => closeJob(row.id), "마감했습니다.")}
            />
          )}
        </div>

        <Note invalid={invalid} changedCount={changedCount} closed={closed} />
      </div>
    </section>
  );
}

/**
 * 버튼 아래 한 줄 — 왜 막혔는지, 누르면 무슨 일이 일어나는지. **문장 하나**만 낸다:
 * 여러 줄을 쌓으면 읽지 않게 되고, 그러면 막힌 이유를 모른 채 누른다.
 */
function Note({
  invalid,
  changedCount,
  closed,
}: {
  invalid: string | null;
  changedCount: number;
  closed: boolean;
}) {
  if (invalid) {
    return (
      <p className="mt-2 text-xs font-semibold break-keep text-destructive" role="alert">
        {invalid}
      </p>
    );
  }
  if (changedCount > 0) {
    return (
      <p className="mt-2 text-xs break-keep text-muted-foreground">
        저장하면 공개 목록 캐시를 함께 비웁니다 — 이 화면은 바로 바뀌고, 방문자는 다음 요청부터 새
        값을 봅니다.
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs leading-relaxed break-keep text-muted-foreground">
      {closed ? (
        <>
          마감된 공고는 목록·검색·sitemap에서 빠지고 지원 연락처도 감춰집니다. 다만{" "}
          <b>상세 주소(URL)는 살아 있습니다.</b>
        </>
      ) : (
        <>
          <b>마감</b>이 공고를 내리는 수단입니다 — 삭제는 없습니다(지우면 다음 수집 실행이 같은
          공고를 다시 올립니다).
        </>
      )}
    </p>
  );
}
