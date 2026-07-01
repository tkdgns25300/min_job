import type { Job, JobStatus } from "@/types/domain";
import type { Position, Department } from "@/constants/domain";

// 재공고 판정 기준 — 같은 자리를 2회 이상 공고
export const REPOST_MIN_COUNT = 2;

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
  if (sameRole.length < REPOST_MIN_COUNT) return null;

  const previous = sameRole
    .filter((j) => j.id !== job.id)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))[0];

  return {
    count: sameRole.length,
    previousPostedAt: previous?.postedAt ?? null,
    previousDeadline: previous?.deadline ?? null,
  };
}

// --- 교회 상세: 자리별 공고 이력 타임라인 ---

export interface RolePosting {
  id: string;
  postedAt: string;
  deadline: string | null;
  status: JobStatus;
}

export interface RoleHistory {
  position: Position;
  department: Department | null;
  postings: RolePosting[]; // 최신순 (공고 횟수 = postings.length)
}

// 공고들을 '자리'(직분+부서)별로 묶어 이력으로. 반복 많은 순 → 최신순 정렬.
export function groupByRole(jobs: Job[]): RoleHistory[] {
  const map = new Map<string, RoleHistory>();
  for (const job of jobs) {
    const key = repostKey(job);
    const group = map.get(key) ?? {
      position: job.position,
      department: job.department,
      postings: [],
    };
    group.postings.push({
      id: job.id,
      postedAt: job.postedAt,
      deadline: job.deadline,
      status: job.status,
    });
    map.set(key, group);
  }
  const groups = [...map.values()];
  for (const g of groups) g.postings.sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  groups.sort(
    (a, b) =>
      b.postings.length - a.postings.length ||
      b.postings[0].postedAt.localeCompare(a.postings[0].postedAt),
  );
  return groups;
}
