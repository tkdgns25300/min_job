"use server";

import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/auth-guard";
import { getReviewRow } from "@/lib/queries/review";
import {
  blankToNull,
  changedEdits,
  denominationChoice,
  editsError,
  normalizeEdits,
  toEdits,
  type ReviewEdits,
} from "@/lib/review-edits";
import { promotionGaps } from "@/lib/review-flags";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/types/database";

// 수집 검수 판정 — `/admin/review**` 세 화면이 함께 쓴다(같은 규칙으로 같은 테이블을 쓰므로
// 라우트마다 복제하지 않는다. CLAUDE.md 배치 규칙의 "라우트 기능 폴더 공용 파일").
//
// ⚠️ **`jobs`에 쓰지 않는다.** 승인은 "공개해도 된다"는 표시일 뿐이고 INSERT는 크롤러가 다음
//    실행에 한다(가드레일 #1 · SPEC). 그래서 `updateTag`도 부르지 않는다 — 이 화면엔 캐시가
//    없고(`lib/queries/review.ts`), 공개 목록(`jobs`)을 바꾸는 것은 이 액션이 아니다.
// ⚠️ **`reject_reason`은 항상 `OPERATOR`다.** `DUPLICATE`로 쓰면 크롤러가 자기 판정으로 보고
//    다음 실행에 되돌린다(constants/review의 경고).

/** 실패만 말이 필요하다 — 성공하면 화면이 이동하거나 자기 상태로 안다 */
export type ReviewActionResult = { ok: true } | { ok: false; message: string };

const QUEUE_PATH = "/admin/review";
const GONE = "이미 없는 항목입니다. 큐를 새로 불러 주세요.";
const ALREADY = "이미 처리된 항목입니다. 큐를 새로 불러 주세요.";
const RACED = "다른 곳에서 먼저 처리됐습니다. 큐를 새로 불러 주세요.";

/**
 * 저장만 — 판정은 `PENDING` 그대로. 한 건을 한 번에 못 끝낼 때 쓴다.
 *
 * ⚠️ **여기서도 `reviewed_by`를 찍는다.** 그 칸이 "사람이 손댔다"의 정본이고, 비어 있으면
 *    **다음 재구조화가 사람의 교정을 AI 초안으로 되돌린다**(크롤러가 "지금 못 막는 유일한 구멍").
 */
export async function saveReview(
  id: string,
  draft: ReviewEdits,
  note: string,
): Promise<ReviewActionResult> {
  const operator = await requireOperator();
  const prepared = await prepareEdits(id, draft);
  if (!prepared.ok) return prepared;
  return write(id, {
    ...prepared.changed,
    review_note: blankToNull(note),
    ...stamp(operator.email),
  });
}

/**
 * 승인 — 고친 값을 저장하고 `APPROVED`로 표시한다. 공개는 크롤러의 다음 실행이 한다.
 * ⚠️ 게이트는 **여기서** 판단한다. 버튼 `disabled`는 화면의 편의고, 막는 것은 서버다.
 */
export async function approveReview(
  id: string,
  draft: ReviewEdits,
  note: string,
): Promise<ReviewActionResult> {
  const operator = await requireOperator();
  const prepared = await prepareEdits(id, draft);
  if (!prepared.ok) return prepared;

  const gaps = promotionGaps(prepared.edits);
  if (gaps.length > 0) {
    return { ok: false, message: `빈 칸이 있어 승인할 수 없습니다 — ${gaps.join("·")}` };
  }

  const result = await write(id, {
    ...prepared.changed,
    review_note: blankToNull(note),
    review_status: "APPROVED",
    // CHECK `review_data_rejection_needs_reason`을 명시적으로 만족시킨다. `PENDING` 행은 이미
    // 사유가 비어 있으니 실질 변화는 없다 — 조건이 코드에 보이게 두는 값이다.
    reject_reason: null,
    ...stamp(operator.email),
  });
  if (!result.ok) return result;
  redirect(QUEUE_PATH);
}

/**
 * 거절 — 사유(메모)가 필수다. 규칙을 고칠 때 이 기록이 유일한 근거다.
 *
 * ⚠️ **고친 값을 함께 저장하지 않는다.** 거절이 편집 유효성에 발목잡히면 **망가진 건을 거절할 수
 *    없게 된다** — 짝이 안 맞는 초안이야말로 거절 대상이다. 거절된 행은 공개되지 않으니 값은 무의미하다.
 */
export async function rejectReview(id: string, note: string): Promise<ReviewActionResult> {
  const operator = await requireOperator();
  const reason = note.trim();
  if (!reason) {
    return {
      ok: false,
      message: "거절 사유를 적어 주세요 — 규칙을 고칠 때 이 기록이 근거가 됩니다.",
    };
  }

  const row = await getReviewRow(id);
  if (!row) return { ok: false, message: GONE };
  if (row.review_status !== "PENDING") return { ok: false, message: ALREADY };

  const result = await write(id, {
    review_note: reason,
    review_status: "REJECTED",
    // `PENDING` 행은 CHECK `rejection_needs_reason`상 `reject_reason`이 비어 있고, 그래서
    // CHECK `duplicate_pairs_with_state`상 `dedup_state`도 'DUPLICATE'가 아니다 — 'OPERATOR'가 안전하다.
    reject_reason: "OPERATOR",
    ...stamp(operator.email),
  });
  if (!result.ok) return result;
  redirect(QUEUE_PATH);
}

/**
 * 되돌리기 — 사람이 내린 **판정만** 큐로 되돌린다.
 *
 * ⚠️ **`reviewed_by`·`reviewed_at`은 지우지 않는다.** 그 칸은 판정이 아니라 "사람이 손댔다"는
 *    표시이고, 지우면 **다음 재구조화가 운영자의 교정을 AI 초안으로 덮어쓴다**(크롤러가 "지금 못
 *    막는 유일한 구멍"이라고 한 것). 되돌리기는 "판정을 취소한다"는 뜻이지 "손댄 적 없다"가 아니다.
 *    → 되돌린 행은 큐에서 **"저장해 둠"** 으로 보인다(사실 그대로다).
 *
 * 두 가지는 되돌리지 않는다: **크롤러 자동 판정**(`reviewed_by`가 빈 행 — 다음 실행이 같은 판정을
 * 다시 내리므로 되돌릴 것이 없다)과 **이미 공개된 건**(`published_job_id` 있음 — 내리는 것은
 * `jobs`를 건드리는 일이라 이 화면의 일이 아니다).
 */
export async function undoReview(id: string): Promise<ReviewActionResult> {
  await requireOperator();
  const row = await getReviewRow(id);
  if (!row) return { ok: false, message: GONE };
  if (row.review_status === "PENDING") return { ok: false, message: "이미 검수 대기 상태입니다." };
  if (!row.reviewed_by) {
    return {
      ok: false,
      message: "크롤러 자동 판정은 되돌릴 수 없어요 — 다음 실행이 다시 판단합니다.",
    };
  }
  if (row.published_job_id) {
    return { ok: false, message: "이미 공개된 공고예요 — 내리는 것은 공고 관리에서 합니다." };
  }

  // 읽은 뒤 쓰기 전에 크롤러가 공개할 수 있다 — 조건을 UPDATE에도 걸어 원자적으로 막는다
  return write(id, { review_status: "PENDING", reject_reason: null }, { onlyUnpublished: true });
}

/** 사람이 판정했다는 표시. `reviewed_by`가 비면 크롤러 자동 판정이다(목록이 그 규칙으로 읽는다) */
function stamp(email: string): Pick<TablesUpdate<"review_data">, "reviewed_by" | "reviewed_at"> {
  return { reviewed_by: email, reviewed_at: new Date().toISOString() };
}

/**
 * 초안을 저장할 수 있는 모양으로 — 저장된 행과 대조해 다듬고 짝을 검사한다.
 * 교단 판정 근거는 **클라이언트가 보낸 값을 믿지 않고** 원래 값과 대조해 여기서 다시 정한다.
 *
 * `edits`(고친 뒤의 전체 상태)와 `changed`(그중 실제로 바뀐 칸)를 둘 다 준다 — **게이트는 전체를,
 * UPDATE는 바뀐 것만** 봐야 한다(전체를 쓰면 크롤러가 그새 재구조화한 값을 덮는다).
 */
async function prepareEdits(
  id: string,
  draft: ReviewEdits,
): Promise<
  { ok: true; edits: ReviewEdits; changed: Partial<ReviewEdits> } | { ok: false; message: string }
> {
  const row = await getReviewRow(id);
  if (!row) return { ok: false, message: GONE };
  if (row.review_status !== "PENDING") return { ok: false, message: ALREADY };

  const original = toEdits(row);
  const edits = normalizeEdits({ ...draft, ...denominationChoice(draft.denomination, original) });
  const error = editsError(edits);
  if (error) return { ok: false, message: error };
  return { ok: true, edits, changed: changedEdits(edits, original) };
}

/**
 * 컬럼명이 `ReviewEdits`와 같아 그대로 넘긴다 — snake_case를 유지한 이유다(seam 머리말).
 *
 * ⚠️ **`select()`로 바뀐 행을 돌려받아 0행을 검출한다.** PostgREST는 조건에 맞는 행이 없어도
 *    에러를 주지 않는다 — 그냥 성공이다. 확인하지 않으면 `onlyUnpublished`가 막은 것을
 *    화면이 **"되돌렸습니다"라고 거짓 보고**한다(읽기와 쓰기 사이에 크롤러가 공개한 경우).
 */
async function write(
  id: string,
  patch: TablesUpdate<"review_data">,
  { onlyUnpublished = false }: { onlyUnpublished?: boolean } = {},
): Promise<ReviewActionResult> {
  const supabase = await createClient();
  const update = supabase.from("review_data").update(patch).eq("id", id);
  const { data, error } = await (
    onlyUnpublished ? update.is("published_job_id", null) : update
  ).select("id");

  if (error) {
    console.error("[review] 저장 실패", error);
    return { ok: false, message: constraintMessage(error.message) };
  }
  return data.length > 0 ? { ok: true } : { ok: false, message: RACED };
}

/**
 * DB가 막았을 때 사람이 읽을 문장. 제약 이름(`review_data_kind_matches_seat`)만으론 무엇을 어떻게
 * 고쳐야 하는지 알 수 없다. 대부분 `editsError`가 먼저 잡으므로 여기까지 오면 화면 쪽 버그다.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  review_data_kind_matches_seat: "종류와 직분·직무명이 짝이 맞지 않습니다.",
  review_data_source_requires_denomination: "교단과 판정 근거가 어긋났습니다.",
  review_data_rejection_needs_reason: "판정과 거절 사유가 짝이 맞지 않습니다.",
  review_data_duplicate_pairs_with_state:
    "중복 사유는 크롤러의 중복 판정과 짝입니다 — 사람의 결론은 '운영자 판단'으로 남깁니다.",
  review_data_pay_range: "사례비 최소가 최대보다 큽니다.",
};

function constraintMessage(dbMessage: string): string {
  const hit = Object.keys(CONSTRAINT_MESSAGES).find((name) => dbMessage.includes(name));
  return hit ? CONSTRAINT_MESSAGES[hit] : "저장에 실패했습니다. 값을 확인해 주세요.";
}
