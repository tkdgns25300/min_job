import { cacheLife, cacheTag } from "next/cache";
import { DEPARTMENTS, JOB_STATUSES, POSITIONS } from "@/constants/domain";
import { keyOf, keysOf } from "@/lib/domain-enum";
import { isPubliclyOpen, todayInSeoul } from "@/lib/job-visibility";
import { createServiceClient } from "@/lib/supabase/service";
import type { Church, PastJob } from "@/types/domain";
import { CHURCH_FULL_COLUMNS, toChurch, type ChurchFullRow } from "./row-map";

// 데이터 소스 seam (교회) — 페이지는 여기서만 가져온다.
//
// cached read라 `service.ts`(secret 키)를 쓴다. ⚠️ **RLS를 우회하므로 "검수 통과분만 공개"를
// 쿼리가 직접 건다**(DATA §3·§9): 인증 신청에서 신규 교회로 적어낸 행은 검수 전 `PENDING`이라
// 그대로 내보내면 운영자가 보기 전에 노출된다. `REJECTED`(허위 판명·opt-out)도 같은 문으로 막힌다.

/** 공개 교회 상세 — 검수 통과분만. 없거나 미승인이면 null(→ notFound) */
export async function getChurch(id: string): Promise<Church | null> {
  "use cache";
  cacheTag("churches");
  cacheLife("days");
  const { data, error } = await createServiceClient()
    .from("churches")
    .select(CHURCH_FULL_COLUMNS)
    .eq("id", id)
    .eq("verification_status", "APPROVED")
    .maybeSingle();

  if (error) throw new Error(`교회 조회 실패: ${error.message}`);
  return data ? toChurch(data as unknown as ChurchFullRow) : null;
}

/** sitemap 전용 — 공개 상세가 열리는 교회 id만(검수 중 교회를 색인시키지 않는다) */
export async function getIndexableChurchIds(): Promise<string[]> {
  "use cache";
  cacheTag("churches");
  cacheLife("days");
  const { data, error } = await createServiceClient()
    .from("churches")
    .select("id")
    .eq("verification_status", "APPROVED");

  if (error) throw new Error(`교회 목록 조회 실패: ${error.message}`);
  return data.map((c) => c.id);
}

/**
 * 교회의 지난 공고 — 최신순.
 * ⚠️ `status === "CLOSED"`만 보면 **만료된 OPEN 공고가 현재 목록에도 지난 공고에도 안 뜬다**
 *    (실측 당시 교회 8곳이 통째로 빈 페이지가 됐다). 공개에서 내려간 것은 전부 여기로 모은다.
 *    그래서 SQL로 `status`를 거르지 않고 그 교회 공고를 다 가져와 `isPubliclyOpen`으로 나눈다.
 */
export async function getChurchPastJobs(churchId: string): Promise<PastJob[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("days");
  const today = todayInSeoul();
  const { data, error } = await createServiceClient()
    .from("jobs")
    .select("id, position, role, department, status, posted_at, deadline")
    .eq("church_id", churchId)
    .order("posted_at", { ascending: false });

  if (error) throw new Error(`교회 지난 공고 조회 실패: ${error.message}`);

  return data
    .filter((j) => !isPubliclyOpen(toVisibility(j), today))
    .map((j) => ({
      id: j.id,
      position: keysOf(POSITIONS, j.position ?? []),
      role: j.role,
      department: keyOf(DEPARTMENTS, j.department),
      postedAt: j.posted_at,
      deadline: j.deadline,
    }));
}

/** 만료 판정에 필요한 세 칸만 — `status`는 좁혀야 술어가 받는다 */
function toVisibility(row: { status: string; deadline: string | null; posted_at: string }) {
  return {
    status: keyOf(JOB_STATUSES, row.status) ?? "CLOSED",
    deadline: row.deadline,
    postedAt: row.posted_at,
  };
}
