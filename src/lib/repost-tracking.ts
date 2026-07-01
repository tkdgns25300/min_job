import type { Job } from "@/types/domain";

// 재공고 추적 — MinJob의 신뢰 정보 차별점.
// "같은 교회 + 같은 직분 + 같은 부서"를 '같은 자리'로 보고 반복 공고를 집계한다.
// (추적 키 최종 확정은 DATA.md 봉인 결정 #4. 지금은 mock 기준의 단일 정의.)

export function repostKey(job: Pick<Job, "churchId" | "position" | "department">): string {
  return `${job.churchId}:${job.position}:${job.department ?? "NONE"}`;
}

export interface RepostInfo {
  count: number; // 같은 자리 총 공고 수 (현재 공고 포함)
  previousPostedAt: string | null; // 직전 공고 등록일
  previousDeadline: string | null; // 직전 공고 마감일
}

// 주어진 공고와 '같은 자리'인 과거·현재 공고를 모아 재공고 정보를 만든다.
// 반복이 없으면(1회뿐) null.
export function getRepostInfo(job: Job, allJobs: Job[]): RepostInfo | null {
  const key = repostKey(job);
  const sameRole = allJobs.filter((j) => repostKey(j) === key);
  if (sameRole.length < 2) return null;

  const previous = sameRole
    .filter((j) => j.id !== job.id)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))[0];

  return {
    count: sameRole.length,
    previousPostedAt: previous?.postedAt ?? null,
    previousDeadline: previous?.deadline ?? null,
  };
}
