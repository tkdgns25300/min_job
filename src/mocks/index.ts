import churchesData from "./churches.json";
import jobsData from "./jobs.json";
import type { Church, Job, JobCard } from "@/types/domain";

// mock 데이터 — 페이지를 만들며 채워나간다. 모든 페이지 완료 시 이 형태가 최종 스키마.
// (실제 DB 연동 시 lib/queries/*.ts + Supabase로 대체)
const churches = churchesData as unknown as Church[];
const jobs = jobsData as unknown as Job[];

const churchById = new Map(churches.map((c) => [c.id, c]));

function toCard(job: Job): JobCard {
  const church = churchById.get(job.churchId);
  return {
    id: job.id,
    title: job.title,
    church: {
      name: church?.name ?? "알 수 없는 교회",
      denomination: church?.denomination ?? "ETC",
      region: church?.region ?? "SEOUL",
      city: church?.city ?? null,
      size: church?.size ?? null,
    },
    position: job.position,
    department: job.department,
    employmentType: job.employmentType,
    stipendMin: job.stipendMin,
    stipendMax: job.stipendMax,
    stipendNote: job.stipendNote,
    featuredTier: job.featuredTier,
    postedAt: job.postedAt,
    deadline: job.deadline,
  };
}

const openJobs = jobs.filter((j) => j.status === "OPEN");

/** 대표광고(HERO) 공고 — 홈 추천 슬롯 */
export function getAdJobs(): JobCard[] {
  return openJobs.filter((j) => j.featuredTier === "HERO").map(toCard);
}

/** 최신 공고 (등록순) */
export function getRecentJobs(limit = 6): JobCard[] {
  return [...openJobs]
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .slice(0, limit)
    .map(toCard);
}

/** 전체 모집 중 공고 카드 (목록 페이지 클라이언트 필터용) */
export function getAllJobCards(): JobCard[] {
  return openJobs.map(toCard);
}

/** 홈 스탯 — 모집 중 수 / 최근 7일 새 공고 수 */
export function getJobStats(): { openCount: number; newThisWeek: number } {
  const openCount = openJobs.length;
  if (openCount === 0) return { openCount: 0, newThisWeek: 0 };
  // 결정성 유지: 기준일 = 최신 공고 등록일 (현재 시각 미사용)
  const latest = openJobs.reduce((m, j) => (j.postedAt > m ? j.postedAt : m), openJobs[0].postedAt);
  const ref = new Date(latest);
  ref.setDate(ref.getDate() - 7);
  const weekAgo = ref.toISOString().slice(0, 10);
  const newThisWeek = openJobs.filter((j) => j.postedAt >= weekAgo).length;
  return { openCount, newThisWeek };
}
