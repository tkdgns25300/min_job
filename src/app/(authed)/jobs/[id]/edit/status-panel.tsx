import { Button } from "@/components/ui/button";
import { JOB_STATUSES } from "@/constants/domain";
import type { Job } from "@/types/domain";

// 상태 관리 + 위험 영역 — 폼과 구분선(별도 면)으로 분리, 맨 아래 (SPEC.md /jobs/[id]/edit §3·4).
// 마감/다시모집/삭제 mutation은 Phase 1 Server Action에서 배선 — mock 단계 비활성.
// TODO(design): ❓ "다시 모집" = 기존 공고 재오픈 vs 새 공고 복제 — 재공고 이력 정합에
// 직결(새 공고가 이력에 정직, 재오픈이 교회 편의). 사람 결정 필요 (SPEC.md #10)
export function JobStatusPanel({ job }: { job: Job }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-base font-bold">상태 관리</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          현재 상태: {JOB_STATUSES[job.status]}
          {job.status === "OPEN" && " — 마감해도 공고 이력은 남아요. 삭제보다 마감을 권해요."}
        </p>
        {job.status === "PENDING" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            검수가 끝나면 여기서 마감·재모집을 관리할 수 있어요.
          </p>
        ) : (
          <div className="mt-4">
            <Button variant="outline" disabled>
              {job.status === "OPEN" ? "모집 마감하기" : "다시 모집"}
            </Button>
          </div>
        )}
      </section>

      {/* 위험 영역 — 삭제는 확인 다이얼로그 필수(실구현) */}
      <section className="rounded-2xl border border-destructive/30 p-5">
        <h2 className="text-base font-bold text-destructive">위험 영역</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          삭제하면 공고와 이력이 함께 사라져요. 마감 처리를 권장해요.
        </p>
        <div className="mt-4">
          <Button variant="destructive" disabled>
            공고 삭제
          </Button>
        </div>
      </section>
    </div>
  );
}
