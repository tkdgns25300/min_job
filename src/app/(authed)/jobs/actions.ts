"use server";

import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth-guard";
import { hasChurchAccess } from "@/lib/auth";
import { DENOMINATIONS, REGIONS } from "@/constants/domain";
import { keyOf } from "@/lib/domain-enum";
import { claimMatchTier } from "@/lib/job-church";
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
//    2026-08-21). 그래서 `status`는 DB 기본값(`OPEN`)에 맡긴다 — 노출은 `jobs`에 칸이 없다(원장이 답한다).

/**
 * 실패만 말이 필요하다 — 성공은 빈 객체고 이동·알림은 호출부가 한다.
 * ⚠️ 등록·수정도 `redirect`를 쓰지 않는다(2026-09-06) — 액션의 `redirect`는 **던져서** `await` 다음 줄이 죽고,
 *    호출부가 토스트도 계측(`job_post`)도 할 수 없다(CLAUDE Styling · 2026-08-27 판정 화면과 같은 함정).
 */
export type JobActionResult = { message?: string; errors?: DraftErrors };

const GONE = "이미 없는 공고예요. 목록을 새로 불러 주세요.";
const SAVE_FAILED = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * 등록 — 인증 교회의 새 공고. 이동은 폼이 한다(대시보드 — 방금 올린 공고가 목록에 보인다).
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
  const { error } = await supabase
    .from("jobs")
    .insert(toInsert(draft, gate.church, todayInSeoul()));
  if (error) {
    console.error("[jobs] 등록 실패", error);
    return { message: SAVE_FAILED };
  }

  updateTag("jobs");
  return {};
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
  return {};
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

const CLAIM_FAILED = "공고를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";
// 후보가 아니거나(경합에 졌거나·마감됐거나) 애초에 가져갈 수 없는 공고 — 세 갈래를 한 말로 답한다.
// 이유를 나눠 말하면 규칙이 새고, 교회가 할 일은 어느 쪽이든 "목록을 다시 부르기"로 같다.
const CLAIM_UNAVAILABLE = "가져올 수 없는 공고예요. 목록을 새로 불러 주세요.";

/**
 * 클레임 — 미배정 크롤 공고를 이 인증 교회 소유로 가져온다(`/jobs/new` 등록 전 후보 패널).
 *
 * 후보 규칙(`claimMatchTier`)을 **서버에서 다시 판정**한다 — 패널이 보여준 것과 무관하게, 클라이언트가
 * 보낸 id는 신뢰 경계 밖이다. 성공하면 `source=CHURCH`가 되어 편집 게이트(`getEditableJob`)와
 * 대시보드 관리 목록에 들어오고, **원문 링크·게시일은 그대로 남는다**(가드레일 #1 출처 표기 —
 * 상세의 "직접 등록" 배지 대신 원문 링크가 출처를 말한다).
 *
 * ⚠️ **`church_name`을 인증된 이름으로 덮어쓰지 않는다.** 크롤러 `dedup_key`의 조각(정규화
 *    교회명·지역·직분)이라, 이름이 바뀌면 같은 자리가 다른 자물쇠가 되어 **다음 실행이 중복을
 *    새로 공개한다**(min_job_agent SPEC §4.1·§4.2). 공고 화면이 공고가 말한 이름을 쓰는 규칙과도
 *    같은 방향이다(`jobChurchRef`).
 * 성공 알림·이동은 호출부가 한다(토스트 + `/jobs/[id]/edit`) — 액션의 `redirect`는 던져서 토스트를 못 띄운다.
 */
export async function claimJob(id: string): Promise<JobActionResult> {
  const gate = await churchGate();
  if ("message" in gate) return gate;

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("jobs")
    .select("church_name, region, denomination, status")
    .eq("id", id)
    .is("church_id", null)
    .eq("source", "OPERATOR")
    .maybeSingle();
  if (error) {
    console.error("[jobs] 클레임 대상 조회 실패", error);
    return { message: CLAIM_FAILED };
  }
  if (!row || row.status !== "OPEN") return { message: CLAIM_UNAVAILABLE };

  const tier = claimMatchTier(gate.church, {
    churchName: row.church_name,
    region: keyOf(REGIONS, row.region),
    denomination: keyOf(DENOMINATIONS, row.denomination),
  });
  if (tier === null) return { message: CLAIM_UNAVAILABLE };

  // `.is("church_id", null)` 재확인 = 동시 클레임 경합 방어 — 먼저 가져간 쪽이 이기고, 진 쪽은 0행이다
  const { error: updateError, count } = await supabase
    .from("jobs")
    // 트리거가 없다 — 여기서 넣지 않으면 `updated_at`이 영원히 생성 시각이다(위 두 액션과 같은 관용구).
    // ⚠️ `posted_at`은 건드리지 않는다 — 소유자만 바뀐 것이라 목록 최신순에서 새 공고처럼 올라가면 안 된다.
    .update(
      { church_id: gate.churchId, source: "CHURCH", updated_at: new Date().toISOString() },
      { count: "exact" },
    )
    .eq("id", id)
    .is("church_id", null);
  if (updateError) {
    console.error("[jobs] 클레임 실패", updateError);
    return { message: CLAIM_FAILED };
  }
  if (!count) return { message: CLAIM_UNAVAILABLE };

  updateTag("jobs");
  return {};
}
