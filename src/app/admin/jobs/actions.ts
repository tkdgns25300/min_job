"use server";

import { updateTag } from "next/cache";
import { requireOperator } from "@/lib/auth-guard";
import {
  changedJobEdits,
  jobEditsError,
  normalizeJobEdits,
  toJobEdits,
  type JobEdits,
} from "@/lib/job-edits";
import { getJobForEdit } from "@/lib/queries/jobs";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/types/database";

// 공개된 공고를 고치고 내리는 mutation — `/admin/jobs`와 `/admin/jobs/[id]`가 함께 쓴다.
//
// ⚠️⚠️ **여기가 우리 앱에서 `jobs`에 쓰는 유일한 곳이다.** 검수 판정은 `review_data`만 건드리고
//    공개는 크롤러가 한다(가드레일 #1). 그래서 검수 액션에 없던 두 가지가 여기 있다:
//      ① `updateTag("jobs")` — 공개 목록·상세·sitemap이 전부 `cacheTag("jobs")`를 달고 한 시간
//         살아 있다. 안 부르면 고친 값이 최대 한 시간 뒤에 반영된다.
//      ② `updated_at` — **트리거가 없다**(DB는 저장 전용 · CLAUDE.md DB Policy). 액션이 직접 넣지
//         않으면 영원히 생성 시각으로 남는다.
//    둘 다 `write()` 한 곳에 가둔다 — 호출부가 기억해야 하는 것을 남기지 않는다.
//
// ⚠️ **크롤러의 칸은 건드리지 않는다.** `posted_at`은 크롤러가 끌어올리고(크롤러 SPEC §4.2b),
//    `source`·`source_url`·`church_id`는 출처·소유권, `featured_tier`는 결제 결과다.
//    `JobEdits`(lib/job-edits)에 그 칸이 없어 타입이 먼저 막는다.
// ⛔ **삭제는 만들지 않는다.** 크롤러가 "공개된 job이 사라졌다"를 감지해 `published_job_id`를 비우고
//    **다시 공개한다**(크롤러 SPEC §4.3). 내리는 수단은 마감이다.

/** 실패만 말이 필요하다 — 성공하면 화면이 다시 읽어 스스로 안다 */
export type JobActionResult = { ok: true } | { ok: false; message: string };

const GONE = "이미 없는 공고입니다. 목록을 새로 불러 주세요.";

/**
 * 값 저장 — 바뀐 칸만 UPDATE한다.
 * ⚠️ 검사는 **여기서** 한다. 화면의 `disabled`는 편의고, 막는 것은 서버다.
 */
export async function saveJob(id: string, draft: JobEdits): Promise<JobActionResult> {
  await requireOperator();

  const row = await getJobForEdit(id);
  if (!row) return { ok: false, message: GONE };

  const edits = normalizeJobEdits(draft);
  const error = jobEditsError(edits);
  if (error) return { ok: false, message: error };

  const changed = changedJobEdits(edits, toJobEdits(row));
  // 고친 것이 없으면 왕복도 하지 않는다 — `updated_at`만 움직이면 "언제 고쳤나"가 거짓이 된다
  if (Object.keys(changed).length === 0) return { ok: true };
  return write(id, changed);
}

/**
 * 내리기 — 목록·검색·sitemap에서 빠지고 상세의 지원 연락처도 사라진다(`isPubliclyOpen`).
 *
 * ⚠️ **URL은 남는다.** `/jobs/[id]`는 마감 안내와 함께 계속 열린다 — 완전한 삭제가 아니다.
 * ⚠️ 같은 자리가 게시판에 다시 올라오면 **새 공고로 발행된다**(마감된 건은 크롤러의 앵커가
 *    아니라서 · 크롤러 SPEC §4.2). 이 건 하나를 내리는 수단이다.
 */
export async function closeJob(id: string): Promise<JobActionResult> {
  await requireOperator();
  return write(id, { status: "CLOSED" });
}

/** 다시 모집 — 잘못 내린 것을 되돌린다. 앵커로 복귀하므로 중복도 다시 막아 준다 */
export async function reopenJob(id: string): Promise<JobActionResult> {
  await requireOperator();
  return write(id, { status: "OPEN" });
}

/**
 * 컬럼명이 `JobEdits`와 같아 그대로 넘긴다 — snake_case를 유지한 이유다(lib/job-edits).
 *
 * ⚠️ **`select()`로 바뀐 행을 돌려받아 0행을 검출한다.** PostgREST는 조건에 맞는 행이 없어도
 *    에러를 주지 않는다 — 그냥 성공이다. 확인하지 않으면 이미 지워진 공고에 대고
 *    "저장했습니다"라고 **거짓 보고**한다.
 */
async function write(id: string, patch: TablesUpdate<"jobs">): Promise<JobActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    // 트리거가 없다 — 여기서 넣지 않으면 `updated_at`이 영원히 생성 시각이다
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[admin/jobs] 저장 실패", error);
    return { ok: false, message: constraintMessage(error.message) };
  }
  if (data.length === 0) return { ok: false, message: GONE };

  // 공개 목록·상세·sitemap이 한 시간 캐시라 여기서 비워야 반영된다(admin 목록도 같은 태그)
  //
  // ⚠️ **"즉시"가 아니다**(실측 2026-08-24). 무효화는 걸리지만 `cacheLife("hours")`의 stale 창
  //    안에서는 다른 방문자가 **직전에 캐시된 목록을 한 번 더 볼 수 있다**(재검증은 그 뒤에 온다).
  //    운영자 화면은 액션 응답이 새 트리를 들고 오고 `router.refresh()`가 있어 바로 바뀐다.
  //    → 검증할 때 액션 직후 한 번만 읽고 "안 됐다"고 읽지 말 것. 그 함정에 한 번 빠졌다.
  updateTag("jobs");
  return { ok: true };
}

/**
 * DB가 막았을 때 사람이 읽을 문장. 제약 이름(`jobs_kind_matches_seat`)만으론 무엇을 어떻게 고쳐야
 * 하는지 알 수 없다. 대부분 `jobEditsError`가 먼저 잡으므로 여기까지 오면 화면 쪽 버그다.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  jobs_kind_matches_seat: "종류와 직분·직무명이 짝이 맞지 않습니다.",
  jobs_needs_contact: "지원 연락처가 하나도 없습니다.",
  jobs_church_posted_needs_church: "교회가 올린 공고는 교회 연결이 있어야 합니다.",
  jobs_collected_needs_source_url: "수집 공고는 출처 링크가 있어야 합니다.",
};

function constraintMessage(dbMessage: string): string {
  const hit = Object.keys(CONSTRAINT_MESSAGES).find((name) => dbMessage.includes(name));
  return hit ? CONSTRAINT_MESSAGES[hit] : "저장에 실패했습니다. 값을 확인해 주세요.";
}
