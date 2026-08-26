"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { requireOperator } from "@/lib/auth-guard";
import { DOC_BUCKET, REJECTION_REASON_MAX } from "@/lib/church-verification";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// 교회 인증 판정 — 승인·반려. **유일한 검수 게이트**다(공고 검수 없음 · ROADMAP 1-4).
//
// **판단은 사람이, 실행은 여기가.** 운영자가 증빙 서류와 공개 출처를 눈으로 대조해 정하고, 버튼은
// 그 결정을 두 테이블에 옮겨 적는다. 손으로 SQL을 치는 것보다 안전하다 — 사유 없는 반려와
// 한쪽 테이블만 바꾸기를 코드가 막는다.
//
// ⚠️ **한 건이 두 테이블에 걸쳐 있다**(DATA §3) — 사람은 `users.church_verification_status`,
//    교회는 `churches.verification_status`. `hasChurchAccess`가 **둘 다** APPROVED일 때만 열리므로
//    승인은 두 곳을 바꾸는데 트랜잭션이 없다(PostgREST). **교회를 먼저** 바꾸는 이유는 하나다:
//    사람 상태가 `PENDING`으로 남아 있어야 **다시 승인을 누를 수 있다**(상태 가드가 판정 전만
//    받는다). 사람을 먼저 바꾸면 부분 실패가 곧 **되돌릴 수도 다시 시도할 수도 없는 상태**가 된다.
//    ⚠️ 그 대가로 부분 실패 시 **교회는 이미 공개된다**. 신청자는 그동안 `/mypage/church`의
//    **"인증을 검토하고 있어요"**(검수중) 카드에 그대로 머문다 — "교회 확인이 끝나면 열려요" 카드는
//    사람만 승인된 상태의 것이라 이 순서에서는 나오지 않는다. 그래서 실패해도 캐시를 비우고
//    (교회가 실제로 공개됐으므로) 사람 말로 어디까지 됐는지 알린다.
//    ⚠️ **다른 창이 그 사이 반려했으면 반려된 교회가 공개된 채 남는다.** 두 테이블을 한 번에 쓸 수
//    없어(트랜잭션 없음) 순서로는 못 막는다 — 운영자가 1명이라는 전제에 기대는 부분이고, 정말
//    막아야 하면 판정을 DB 함수로 옮겨야 한다("DB는 저장 전용" 정책과 부딪힌다).
// ⛔ **되돌리기를 만들지 않는다.** 반려는 증빙을 파기하므로 되돌려도 열 서류가 없고(신청자가
//    재신청하면 된다), 승인 취소는 그 교회가 이미 올린 공고를 함께 내리는 규칙이 있어야 성립한다
//    (공고의 공개 판정은 `jobs.status`·마감일이지 교회 검증 상태가 아니다 · ROADMAP).

const QUEUE_PATH = "/admin/verify";
const GONE = "이미 없는 신청입니다. 목록을 새로 불러 주세요.";
const ALREADY = "이미 처리된 신청입니다. 목록을 새로 불러 주세요.";

/**
 * 실패만 말이 필요하다 — 성공하면 큐로 `redirect`하므로 **돌아오는 값 자체가 실패의 표시**다.
 * ⚠️ `ok` 같은 판별자를 두지 않는다: 한 갈래뿐이라 죽은 필드가 되고, 나중에 성공 모양을 더하면
 *    호출부의 `if (result)`가 성공을 오류로 그린다.
 */
export type VerifyActionResult = { message: string };

/**
 * ⚠️ **한 리터럴로 둔다** — `+`로 이어 붙이면 타입이 `string`으로 넓어져 PostgREST의 행 추론이
 *    죽고, 돌아온 값이 `GenericStringError`가 된다(실측 2026-08-26).
 */
const PENDING_SELECT = `church_id, church_verification_status, verification_doc_path,
  verification_contact_tel, verification_contact_email, verification_submitted_at`;

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** 판정 대상 한 건 — 상태 가드와 뒤 처리에 필요한 값만 */
type Application = {
  churchId: string;
  docPath: string | null;
  contactTel: string | null;
  contactEmail: string | null;
  /**
   * 읽은 시점의 제출 시각 — **판정 UPDATE의 가드로 쓴다.** 상태만 보면 안 된다: 읽고 쓰는 사이에
   * 신청자가 **재신청**하면 상태가 다시 `PENDING`이 되어 가드를 통과하고, 그러면 방금 낸 새 신청이
   * 옛 사유로 반려되고 `removeDoc`가 옛 경로를 지워 **새 파일이 고아가 된다**.
   * (수집 검수 `onlyUnpublished`와 같은 관용구다.)
   */
  submittedAt: string;
};

/**
 * 승인 — 교회를 `APPROVED`로 올리고, 사무용 연락처를 교회 행으로 옮긴 뒤, 사람을 `APPROVED`로 만든다.
 *
 * ⚠️ **연락처는 비어 있을 때만 채운다.** 신청자가 적어낸 값이라, 기존 교회에 이미 확인된 값이
 *    있으면 그쪽이 우선이다 — 아직 검증 안 된 사람의 입력이 검증된 교회 정보를 덮어쓰면 안 된다(SPEC).
 * ⚠️ **증빙 서류는 지우지 않는다** — 방침이 "인증 자격이 유지되는 동안 보관"이다(`/privacy` §3).
 *    판정 근거를 들고 있어야 이의가 들어왔을 때 답할 수 있다.
 */
export async function approveVerification(userId: string): Promise<VerifyActionResult> {
  await requireOperator();
  const supabase = await createClient();

  const application = await loadPending(supabase, userId);
  if ("message" in application) return application;
  const { churchId, contactTel, contactEmail } = application.value;

  const church = await supabase
    .from("churches")
    .select("contact_tel, contact_email")
    .eq("id", churchId)
    .maybeSingle();
  if (church.error || church.data === null) {
    console.error("[verify] 교회 조회 실패", churchId, church.error);
    return { message: GONE };
  }

  const promoted = await supabase
    .from("churches")
    .update({
      verification_status: "APPROVED",
      contact_tel: church.data.contact_tel ?? contactTel,
      contact_email: church.data.contact_email ?? contactEmail,
    })
    .eq("id", churchId)
    .select("id");
  if (promoted.error || promoted.data.length === 0) {
    console.error("[verify] 교회 승인 실패", churchId, promoted.error);
    return { message: "승인하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  const decided = await decide(supabase, userId, application.value, {
    church_verification_status: "APPROVED",
    verification_rejection_reason: null,
  });
  if (decided) {
    // ⚠️ 교회는 이미 올라갔다 — 캐시를 그대로 두면 "공개됐는데 안 보이는" 상태가 한 시간 남는다.
    //    실패했다고 조용히 넘기지 않고, 어디까지 됐는지 사람 말로 알린다(다시 누르면 채워진다).
    updateTag("churches");
    return { message: `${decided.message} (교회는 이미 공개됐고 담당자 자격만 남았습니다)` };
  }

  // 공개 교회 조회는 전부 `verification_status='APPROVED'`로 거르므로(lib/queries/churches.ts),
  // 방금 올린 교회는 캐시를 비워야 보인다 — 상세·sitemap이 같은 태그를 쓴다
  updateTag("churches");
  redirect(QUEUE_PATH);
}

/**
 * 반려 — 사유를 남기고 **증빙 서류를 파기한다.**
 *
 * ⚠️ 사유는 빈 값일 수 없다(DB `users_rejected_needs_reason`도 막는다) — 사유 없이 반려하면
 *    신청자는 무엇을 고쳐야 할지 모른 채 같은 서류로 다시 낸다.
 * ⚠️ **서류를 지우는 것이 승인과 갈리는 지점이다.** 방침은 "인증 자격이 유지되는 동안 보관"인데
 *    반려된 신청에는 자격이 없다(`/privacy` §3). 순서는 **DB 먼저, 파일 나중**이다 — 파일을 먼저
 *    지우면 DB가 실패했을 때 **없는 파일을 가리키는 신청**이 남는다.
 */
export async function rejectVerification(
  userId: string,
  reason: string,
): Promise<VerifyActionResult> {
  await requireOperator();

  // 화면도 막지만 막는 것은 서버다 — 직접 호출로 사유 없는 반려를 만들 수 없다
  const trimmed = reason.trim();
  if (trimmed.length === 0) return { message: "반려 사유를 적어 주세요." };
  if (trimmed.length > REJECTION_REASON_MAX) {
    return { message: `반려 사유는 ${REJECTION_REASON_MAX}자까지 적을 수 있어요.` };
  }

  const supabase = await createClient();
  const application = await loadPending(supabase, userId);
  if ("message" in application) return application;

  const decided = await decide(supabase, userId, application.value, {
    church_verification_status: "REJECTED",
    verification_rejection_reason: trimmed,
    verification_doc_path: null,
  });
  if (decided) return decided;

  const { docPath } = application.value;
  if (docPath !== null) await removeDoc(docPath);

  // ⛔ `updateTag`을 부르지 않는다 — 반려는 공개되는 것을 아무것도 바꾸지 않는다.
  //    교회 행은 `PENDING` 그대로라 애초에 캐시된 공개 조회에 들어 있지 않다.
  redirect(QUEUE_PATH);
}

/**
 * 판정 대상 읽기 + 상태 가드. **판정 전(`PENDING`)만 받는다** — 이미 처리된 신청을 다시 판정하면
 * 승인이 반려를 덮거나 그 반대가 되고, 화면은 그 사이 다른 창에서 처리된 것을 모른다.
 */
async function loadPending(
  supabase: ServerClient,
  userId: string,
): Promise<{ value: Application } | VerifyActionResult> {
  const { data, error } = await supabase
    .from("users")
    .select(PENDING_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[verify] 신청 조회 실패", userId, error);
    return { message: "불러오지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  // 제출 시각이 없으면 신청이 아니다 — 로그인만 한 계정도 `users` 행을 갖는다(queries/verifications)
  if (data === null || data.verification_submitted_at === null || data.church_id === null) {
    return { message: GONE };
  }
  // 상태가 비어 있으면 아직 판정 전이다(목록·홈이 쓰는 판정과 같다)
  if (data.church_verification_status !== null && data.church_verification_status !== "PENDING") {
    return { message: ALREADY };
  }

  return {
    value: {
      churchId: data.church_id,
      docPath: data.verification_doc_path,
      contactTel: data.verification_contact_tel,
      contactEmail: data.verification_contact_email,
      submittedAt: data.verification_submitted_at,
    },
  };
}

/** 사람 쪽 판정 기록 — 실패했을 때만 결과를 돌려준다(`null` = 저장됨) */
async function decide(
  supabase: ServerClient,
  userId: string,
  application: Application,
  patch: {
    church_verification_status: "APPROVED" | "REJECTED";
    verification_rejection_reason: string | null;
    verification_doc_path?: null;
  },
): Promise<VerifyActionResult | null> {
  const { data, error } = await supabase
    .from("users")
    .update({ ...patch, verification_reviewed_at: new Date().toISOString() })
    .eq("id", userId)
    // 다른 창이 먼저 판정했으면 여기서 0행이 된다
    .or("church_verification_status.is.null,church_verification_status.eq.PENDING")
    // **읽은 그 신청에만 쓴다** — 그 사이 재신청이 들어왔으면 제출 시각이 달라져 0행이 된다
    .eq("verification_submitted_at", application.submittedAt)
    .select("id");

  if (error) {
    console.error("[verify] 판정 기록 실패", userId, error);
    return { message: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  // 0행 UPDATE는 PostgREST에서 성공으로 온다 — 조건에 걸린 것이지 저장된 것이 아니다
  if (data.length === 0) return { message: ALREADY };
  return null;
}

/** 서류 파기 — 실패해도 판정을 되돌리지 않는다(경로는 이미 지웠고, 고아 파일은 로그로 남긴다) */
async function removeDoc(path: string): Promise<void> {
  const { error } = await createServiceClient().storage.from(DOC_BUCKET).remove([path]);
  if (error) console.error("[verify] 증빙 파기 실패", path, error);
}
