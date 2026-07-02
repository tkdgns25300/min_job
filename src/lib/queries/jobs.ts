import { cacheTag } from "next/cache";
import * as mock from "@/mocks";
import type { JobCard, JobDetail } from "@/types/domain";
import type { RepostInfo } from "@/lib/repost-tracking";

// 데이터 소스 seam (공고) — 페이지는 여기서만 가져온다.
// 현재 mock 위임. DB 전환 시 본문만 service.ts Supabase 호출로 교체(시그니처·타입 동일).

export async function getAdJobs(): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs");
  return mock.getAdJobs();
}

export async function getRecentJobs(limit = 6): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs");
  return mock.getRecentJobs(limit);
}

export async function getAllJobCards(): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs");
  return mock.getAllJobCards();
}

export async function getJobStats(): Promise<{
  openCount: number;
  newThisWeek: number;
  churchCount: number;
}> {
  "use cache";
  cacheTag("jobs");
  return mock.getJobStats();
}

export async function getJobDetail(id: string): Promise<JobDetail | null> {
  "use cache";
  cacheTag("jobs", `job-${id}`);
  return mock.getJobDetail(id);
}

export async function getRepost(id: string): Promise<RepostInfo | null> {
  "use cache";
  cacheTag("jobs");
  return mock.getRepost(id);
}

export async function getSimilarJobs(id: string, limit = 4): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs");
  return mock.getSimilarJobs(id, limit);
}

export async function getChurchOpenJobs(churchId: string, excludeId?: string): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs");
  return mock.getChurchOpenJobs(churchId, excludeId);
}

export async function getSearchSuggestions(): Promise<string[]> {
  "use cache";
  cacheTag("jobs");
  return mock.getSearchSuggestions();
}
