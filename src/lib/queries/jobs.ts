import { cacheLife, cacheTag } from "next/cache";
import * as mock from "@/mocks";
import { todayInSeoul } from "@/lib/job-visibility";
import type { AdminJob, AdminOverview, JobCard, JobDetail } from "@/types/domain";

// 데이터 소스 seam (공고) — 페이지는 여기서만 가져온다.
// 현재 mock 위임. DB 전환 시 본문만 service.ts Supabase 호출로 교체(시그니처·타입 동일).

// 만료 판정 기준일은 **cached scope 안에서** 만든다 (CLAUDE.md `'use cache'` 제약 #2).
// 호출부(`/jobs`·홈·`sitemap.xml`)가 전부 프리렌더 스코프라 거기서 `new Date()`를 부르면
// **빌드 시각이 굳는다**. 여기서 만들면 `cacheLife("days")`와 함께 하루마다 갱신되므로
// 만료가 최대 하루 늦게 반영되지만, 공고 목록 자체가 하루 캐시라 무해하다.
// 인자로 받으려면 호출부에 `await connection()`이 필요하고 `◐ PPR` → `ƒ` 로 떨어진다.

export async function getAdJobs(): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getAdJobs(todayInSeoul());
}

export async function getListJobs(limit = 8): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getListJobs(todayInSeoul(), limit);
}

export async function getAllJobCards(): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getAllJobCards(todayInSeoul());
}

/** 저장한 공고 해석용 — 만료·마감분 포함(북마크가 조용히 사라지지 않게). 마이페이지 전용 */
export async function getSavedJobCards(): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getSavedJobCards(todayInSeoul());
}

/** 운영자 공고 관리 — 전체 공고(모든 상태·출처). admin/jobs 전용. 탭·필터는 클라이언트 */
export async function getAdminJobs(): Promise<AdminJob[]> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getAdminJobs(todayInSeoul());
}

/** 운영자 홈 요약 — 노출중(유료 OPEN)·이번주 등록·전체 공고. admin 홈 전용 */
export async function getAdminOverview(): Promise<AdminOverview> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getAdminOverview(todayInSeoul());
}

export async function getJobStats(): Promise<{
  openCount: number;
  newThisWeek: number;
  churchCount: number;
}> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getJobStats(todayInSeoul());
}

export async function getCoverageStats(): Promise<{
  openCount: number;
  churchCount: number;
  regionCount: number;
  denominationCount: number;
}> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("days");
  return mock.getCoverageStats(todayInSeoul());
}

export async function getJobDetail(id: string): Promise<JobDetail | null> {
  "use cache";
  cacheTag("jobs", `job-${id}`);
  cacheLife("days");
  return mock.getJobDetail(id, todayInSeoul());
}

export async function getSimilarJobs(id: string, limit = 4): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getSimilarJobs(id, todayInSeoul(), limit);
}

export async function getChurchOpenJobs(churchId: string, excludeId?: string): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getChurchOpenJobs(churchId, todayInSeoul(), excludeId);
}

export async function getSearchSuggestions(): Promise<string[]> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getSearchSuggestions(todayInSeoul());
}
