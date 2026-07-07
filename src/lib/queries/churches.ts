import { cacheLife, cacheTag } from "next/cache";
import * as mock from "@/mocks";
import type { Church } from "@/types/domain";
import type { RoleHistory } from "@/lib/repost-tracking";

// 데이터 소스 seam (교회) — 페이지는 여기서만 가져온다.
// 현재 mock 위임. DB 전환 시 본문만 service.ts Supabase 호출로 교체(시그니처·타입 동일).

export async function getChurch(id: string): Promise<Church | null> {
  "use cache";
  cacheTag("churches");
  cacheLife("days");
  return mock.getChurch(id);
}

export async function getChurchTimeline(churchId: string): Promise<RoleHistory[]> {
  "use cache";
  cacheTag("jobs");
  cacheLife("days");
  return mock.getChurchTimeline(churchId);
}
