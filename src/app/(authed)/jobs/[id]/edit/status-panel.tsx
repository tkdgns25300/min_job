"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { JOB_STATUSES } from "@/constants/domain";
import { setJobStatus } from "../../actions";
import type { Job } from "@/types/domain";

// 상태 관리 — 폼과 구분선으로 나눠 맨 아래 둔다(SPEC `/jobs/[id]/edit`).
//
// ⛔ **삭제를 만들지 않았다**(2026-08-26에 버튼도 없앴다). 마감하면 공고 이력이 남고, 지우면 그
//    교회가 언제 무엇을 뽑았는지가 사라진다 — 화면이 이미 "삭제보다 마감을 권해요"라고 말하고
//    있었는데 그 아래 삭제 버튼이 `disabled`로 남아 있었다. 안 만들 기능의 버튼은 두지 않는다.
// ⚠️ **"다시 모집"은 기존 공고를 다시 여는 것**이다 — 새 공고 복제가 아니다(`/admin/jobs`와 같다).
//    복제하면 같은 자리가 목록에 두 번 뜬다. (이 결정이 주석에 ❓로 남아 있던 자리다.)
export function JobStatusPanel({ job }: { job: Job }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startChange] = useTransition();
  const open = job.status === "OPEN";

  const change = () =>
    startChange(async () => {
      setError(null);
      try {
        // 성공하면 `updateTag("jobs")`가 이 페이지의 값도 새로 읽게 만든다 — 화면에 머문다
        const result = await setJobStatus(job.id, !open);
        if (result.message) setError(result.message);
      } catch (thrown) {
        unstable_rethrow(thrown);
        console.error("[jobs] 상태 변경 실패", thrown);
        setError("처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="text-base font-bold">상태 관리</h2>
      <p className="mt-1 text-sm break-keep text-muted-foreground">
        현재 상태: {JOB_STATUSES[job.status]}
        {open && " — 마감해도 공고 이력은 남아요. 사람을 다 뽑으면 마감해 주세요."}
      </p>

      {error && (
        <p className="mt-3 text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4">
        {open ? (
          // 마감은 되돌릴 수 있지만(다시 모집) 그 사이 목록에서 사라진다 — 한 번 더 묻는다
          <ConfirmButton
            label={pending ? "처리 중…" : "모집 마감하기"}
            confirmLabel="마감 확인"
            hint="마감하면 공개 목록에서 내려가요."
            disabled={pending}
            onConfirm={change}
          />
        ) : (
          <ConfirmButton
            label={pending ? "처리 중…" : "다시 모집"}
            confirmLabel="다시 모집합니다"
            confirmVariant="default"
            hint="이 공고를 그대로 다시 열어요(새 공고를 만들지 않아요)."
            disabled={pending}
            onConfirm={change}
          />
        )}
      </div>
    </section>
  );
}
