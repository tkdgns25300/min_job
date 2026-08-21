import { cacheLife, cacheTag } from "next/cache";
import * as mock from "@/mocks";
import { todayInSeoul } from "@/lib/job-visibility";
import type { Church, PastJob } from "@/types/domain";

// 데이터 소스 seam (교회) — 페이지는 여기서만 가져온다.
// 현재 mock 위임. DB 전환 시 본문만 service.ts Supabase 호출로 교체(시그니처·타입 동일).

export async function getChurch(id: string): Promise<Church | null> {
  "use cache";
  cacheTag("churches");
  cacheLife("days");
  return mock.getChurch(id);
}

/** sitemap 전용 — 공개 상세가 열리는 교회 id만(검수 중 교회를 색인시키지 않는다) */
export async function getIndexableChurchIds(): Promise<string[]> {
  "use cache";
  cacheTag("churches");
  cacheLife("days");
  return mock.getIndexableChurchIds();
}

export async function getChurchPastJobs(churchId: string): Promise<PastJob[]> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getChurchPastJobs(churchId, todayInSeoul());
}
