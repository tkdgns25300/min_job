"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth-guard";
import { hasChurchAccess } from "@/lib/auth";
import { draftErrors, toInsert, toUpdate, type DraftErrors, type JobDraft } from "@/lib/job-draft";
import { todayInSeoul } from "@/lib/job-visibility";
import { getChurch } from "@/lib/queries/churches";
import { getEditableJob } from "@/lib/queries/users";
import { createClient } from "@/lib/supabase/server";
import type { Church } from "@/types/domain";

// 교회가 직접 등록·수정·마감하는 공고 mutation.
//
// ⚠️ **`jobs` 한 테이블만 쓴다.** 교회 값(`church_name`·`denomination`·`region`·`city`·`address`)은
//    인증된 `churches` 행에서 **읽어서 복사**한다(DATA §1 의도적 비정규화) — `churches`를 고치지
//    않는다. 공고 폼에서 교회 정보를 고치게 하면 미검증 값이 인증된 교회를 덮어쓴다.
//
// ⚠️ **`church_id`를 클라이언트에서 받지 않는다.** 세션의 인증 교회로 강제한다 — 받으면 남의
//    교회 이름으로 공고를 올릴 수 있다. 공고에 작성자 컬럼이 없는 것도 같은 결이다(가드레일 #2):
//    권한은 사람이 아니라 **그 교회의 인증 관리자**라는 자격에서 온다.
//
// ⚠️ **검수가 없다.** 교회가 등록하면 바로 `OPEN`이다 — 인증이 게이트다(가드레일 #1 개정
//    2026-08-21). 그래서 `status`·`featured_tier`는 DB 기본값(`OPEN`·`NONE`)에 맡긴다.

/** 실패만 말이 필요하다 — 성공하면 `redirect`가 나간다 */
export type JobActionResult = { message?: string; errors?: DraftErrors };

const DASHBOARD = "/mypage/church";
const GONE = "이미 없는 공고예요. 목록을 새로 불러 주세요.";
const SAVE_FAILED = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * 등록 — 인증 교회의 새 공고. 성공하면 대시보드로 보낸다(방금 올린 공고가 목록에 보인다).
 *
 * ⚠️ 게이트를 **여기서 다시 본다.** 페이지가 이미 `hasChurchAccess`를 확인하지만 액션은 직접
 *    호출될 수 있고, 신뢰 경계는 서버다(CLAUDE 2단 방어).
 */
export async function createJob(draft: JobDraft): Promise<JobActionResult> {
  const gate = await churchGate();
  if ("message" in gate) return gate;

  const errors = draftErrors(draft);
  if (Object.keys(errors).length > 0) return { errors };

  const supabase = await createClient();
  const { error } = await supabase.from("jobs").insert(toInsert(draft, gate.church, todayInSeoul()));
  if (error) {
    console.error("[jobs] 등록 실패", error);
    return { message: SAVE_FAILED };
  }

  updateTag("jobs");
  redirect(DASHBOARD);
}

/**
 * 수정 — **자기 교회 공고만.** `getEditableJob`이 소유권과 claim 여부를 함께 본다(미claim 크롤
 * 공고는 교회가 고칠 수 없다).
 *
 * ⚠️ **`posted_at`을 다시 찍지 않는다**(`toUpdate`가 그 칸을 아예 만들지 않는다) — 찍으면 수정만
 *    해도 목록 최신순에서 새 공고처럼 올라간다. 수정으로 순위를 살 수 있게 하지 않는다.
 */
export async function updateJob(id: string, draft: JobDraft): Promise<JobActionResult> {
  const gate = await churchGate();
  if ("message" in gate) return gate;

  const owned = await getEditableJob(id, gate.churchId);
  if (!owned) return { message: GONE };

  // 저장돼 있던 마감일을 함께 넘긴다 — 지난 마감일 금지는 등록 기준의 규칙이라, 그대로 걸면
  // 마감된 공고에서 제목 오타 하나 고치는 것까지 막힌다(`job-draft`의 `previousDeadline`).
  const errors = draftErrors(draft, owned.deadline);
  if (Object.keys(errors).length > 0) return { errors };

  const supabase = await createClient();
  const saved = await supabase
    .from("jobs")
    // 트리거가 없다(DB는 저장 전용 · CLAUDE DB Policy) — 여기서 넣지 않으면 `updated_at`이
    // 영원히 생성 시각이다. `/admin/jobs`의 저장 액션과 같은 관용구.
    .update({ ...toUpdate(draft), updated_at: new Date().toISOString() })
    .eq("id", id)
    // 게이트를 통과했어도 조건을 걸어 둔다 — 0행이면 그 사이 바뀐 것이다
    .eq("church_id", gate.churchId)
    .select("id");
  if (saved.error) {
    console.error("[jobs] 수정 실패", id, saved.error);
    return { message: SAVE_FAILED };
  }
  // 0행 UPDATE는 PostgREST에서 성공으로 온다 — 조건에 걸린 것이지 저장된 것이 아니다
  if (saved.data.length === 0) return { message: GONE };

  updateTag("jobs");
  redirect(DASHBOARD);
}

/**
 * 마감 · 다시 모집 — 같은 함수로 둔다. 하는 일이 `status` 한 칸이고, 두 갈래를 나누면 게이트와
 * 소유권 확인이 그대로 복제된다.
 *
 * ⛔ **삭제는 만들지 않는다.** 마감해도 공고 이력은 남고, 지우면 그 교회가 언제 무엇을 뽑았는지가
 *    사라진다. 화면도 "삭제보다 마감을 권해요"라고 말한다.
 * ⚠️ **"다시 모집"은 기존 공고를 다시 여는 것**이다(새 공고 복제가 아니다) — `/admin/jobs`가 이미
 *    그렇게 하고, 복제하면 같은 자리가 목록에 두 번 뜬다.
 */
export async function setJobStatus(id: string, open: boolean): Promise<JobActionResult> {
  const gate = await churchGate();
  if ("message" in gate) return gate;

  const supabase = await createClient();
  const saved = await supabase
    .from("jobs")
    // 트리거가 없다 — 여기서 넣지 않으면 `updated_at`이 영원히 생성 시각이다(admin/jobs와 같다)
    .update({ status: open ? "OPEN" : "CLOSED", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("church_id", gate.churchId)
    .select("id");
  if (saved.error) {
    console.error("[jobs] 상태 변경 실패", id, saved.error);
    return { message: SAVE_FAILED };
  }
  if (saved.data.length === 0) return { message: GONE };

  updateTag("jobs");
  // 수정 화면에 머문다 — 마감 뒤 "다시 모집"을 바로 누를 수 있고, 대시보드로 튀면 방금 무엇을
  // 했는지 확인하러 되돌아와야 한다. `updateTag`이 이 페이지의 값도 새로 읽게 만든다.
  return {};
}

/**
 * 공고를 쓸 자격 + 그 교회 — 세 액션이 같은 관문을 쓴다.
 * ⚠️ `getChurch`는 `verification_status='APPROVED'`만 돌려준다(`lib/queries/churches`) —
 *    사람과 교회 양쪽이 승인돼야 통과한다는 `hasChurchAccess`와 같은 답이 나온다.
 */
async function churchGate(): Promise<{ churchId: string; church: Church } | { message: string }> {
  const user = await requireUser();
  if (!hasChurchAccess(user) || user.churchId === null) {
    return { message: "교회 인증이 필요해요." };
  }
  const church = await getChurch(user.churchId);
  if (church === null) return { message: "교회 정보를 찾지 못했어요." };
  return { churchId: user.churchId, church };
}
