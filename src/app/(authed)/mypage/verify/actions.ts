"use server";

import { randomUUID } from "node:crypto";
import { PRIVACY_EFFECTIVE_DATE } from "@/constants/business";
import { requireUser } from "@/lib/auth-guard";
import {
  applicantDraftErrors,
  blankToNull,
  churchDraftErrors,
  DOC_BUCKET,
  docError,
  docExtension,
  docMime,
  normalizeRegistrationNo,
  parseDenomination,
  registrationNoError,
  type FieldErrors,
} from "@/lib/church-verification";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// 교회 인증 신청 mutation.
//
// ⚠️ **`lookupChurch`는 mutation이 아니다.** 그런데도 여기 있는 이유: 클라이언트가 제출 전에
//    "처음인가 기존인가"를 물어야 하고, 데이터 조회용 route handler는 금지되어 있다(CLAUDE).
//    Server Action이 규칙이 남긴 유일한 경로다.
// ⚠️ **증빙 업로드는 `service.ts`(secret 키)를 쓴다** — `storage.objects`는 RLS가 항상 켜져 있고
//    `verification-docs` 버킷엔 정책이 없어 publishable 키로는 조용히 실패한다(포스터에서 실측).
//    포스터 예외와 성격이 다르다(그건 운영자 게이트 뒤의 **읽기**, 이건 일반 사용자가 트리거하는
//    **쓰기**)므로 방어를 코드로 만든다: **경로에 사용자 입력을 넣지 않고**(`{uid}/{uuid}.{ext}`)
//    `upsert: false`로 덮어쓰기를 막는다. 파일명·MIME은 버킷 설정이 한 번 더 거른다.

// ⚠️ **폼이 이 액션을 `<form action={...}>`으로 직접 받지 않는다.** React는 폼 액션을 실행하기
//    **전에** `requestFormReset`을 무조건 부르므로(react-dom `startHostTransition`), 검증 오류를
//    돌려주면 **입력이 통째로 비워진 채 오류만 남는다** — 고른 파일까지 사라진다. 그래서 폼은
//    `onSubmit`에서 `FormData`를 만들어 이 함수를 부르고, 결과를 자기 state로 받는다.
//    (JS 없는 제출은 어차피 불가능하다 — 2·3·4단계 게이트가 고유번호 확인 결과에 걸려 있다.)

export type LookupResult =
  { kind: "new" } | { kind: "existing"; churchName: string } | { kind: "error"; message: string };

/**
 * 고유번호로 교회를 찾는다 — 화면이 교회 정보 칸을 펼칠지 결정하는 데 쓴다.
 *
 * ⚠️ **검증 상태(`PENDING`/`APPROVED`)는 돌려주지 않는다.** 사용자가 알 필요가 없고, 알려주면
 *    "이 교회가 우리 플랫폼에서 인증됐나"를 아무나 조회할 수 있게 된다. 필요한 것은 이름 하나다 —
 *    엉뚱한 교회에 붙는지 확인하는 용도.
 * ⚠️ 이 조회를 건너뛰고 바로 제출해도 안전하다 — 신청 액션이 같은 조회를 다시 한다.
 */
export async function lookupChurch(input: string): Promise<LookupResult> {
  await requireUser();

  const invalid = registrationNoError(input);
  if (invalid) return { kind: "error", message: invalid };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("churches")
    .select("name")
    .eq("registration_no", normalizeRegistrationNo(input))
    .maybeSingle();

  if (error) {
    console.error("[verify] 교회 조회 실패", error);
    return { kind: "error", message: "확인하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  return data === null ? { kind: "new" } : { kind: "existing", churchName: data.name };
}

/**
 * 제출 결과 — 성공은 빈 객체(알림·계측·다시 그리기는 폼이 한다 · CLAUDE Styling), 실패만 말이 있다.
 * ⚠️ 한때 성공을 `redirect`로 알렸는데 그건 **던져서** `await` 다음 줄이 죽는다(2026-09-06 · 등록 액션과 같이 고침).
 * ⚠️ 초기값 상수를 여기서 export하지 않는다: `"use server"` 파일은 **async 함수만** 내보낼 수 있고
 *    객체를 내보내면 빌드는 통과한 뒤 요청에서 터진다(실측 2026-08-25).
 */
export type ApplyResult = { message?: string; errors?: FieldErrors };

/**
 * 인증 신청 접수. 성공하면 폼이 같은 페이지를 다시 그려 **접수 안내**(PENDING)를 보여준다.
 *
 * 순서가 뜻을 갖는다: **새 파일 업로드 → DB 기록 → 옛 파일 삭제.** 옛 파일을 먼저 지우면 DB가
 * 실패했을 때 **DB가 없는 파일을 가리킨다.**
 */
export async function applyChurchVerification(form: FormData): Promise<ApplyResult> {
  const user = await requireUser();

  // 직접 POST 방어 — 화면은 이 상태에서 폼을 보여주지 않는다
  if (user.churchVerificationStatus === "APPROVED") {
    return { message: "이미 인증된 계정이에요." };
  }
  if (user.churchVerificationStatus === "PENDING") {
    return { message: "이미 접수된 신청이 검토 중이에요." };
  }
  // 동의는 DB CHECK(`users_submitted_needs_consent`)도 막지만, 사람이 읽을 말은 여기서 만든다
  if (form.get("consent") !== "on") {
    return { message: "약관·개인정보 수집에 동의해 주세요." };
  }

  // ⚠️ `File`이 섞여 오면 `String()`이 `"[object File]"`을 만든다 — 조작된 요청이 그 문자열을
  //    교회명으로 저장하게 두지 않는다. 문자열이 아니면 빈 값으로 본다(그러면 필수 검증에 걸린다).
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const registrationNo = normalizeRegistrationNo(text("registrationNo"));
  const file = form.get("doc");
  const doc = file instanceof File ? file : null;

  const supabase = await createClient();
  const { data: found, error: lookupError } = await supabase
    .from("churches")
    .select("id")
    .eq("registration_no", registrationNo)
    .maybeSingle();
  if (lookupError) {
    console.error("[verify] 교회 조회 실패", lookupError);
    return { message: "접수하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  // 기존 교회면 교회 칸을 받지도 않았으므로 검증에서도 뺀다.
  // ⚠️ 그 경우 고유번호를 다시 볼 필요가 없다 — 행에 붙었다는 것이 이미
  //    `churches_registration_no_check`(`^[0-9]{10}$`)를 통과했다는 뜻이다.
  const errors: FieldErrors = {
    ...(found === null
      ? churchDraftErrors({
          registrationNo: text("registrationNo"),
          name: text("churchName"),
          denomination: text("denomination"),
          region: text("region"),
          city: text("city"),
          address: text("address"),
        })
      : {}),
    ...applicantDraftErrors({
      applicantName: text("applicantName"),
      position: text("position"),
      contactTel: text("contactTel"),
      contactEmail: text("contactEmail"),
    }),
  };
  const docFailure = docError(doc);
  if (docFailure) errors.doc = docFailure;
  if (Object.keys(errors).length > 0) return { errors };

  // 파일부터 올린다 — DB를 먼저 쓰면 업로드 실패 시 경로만 남은 행이 생긴다.
  // ⚠️ MIME은 `docMime`이 정한다 — 브라우저가 빈 `type`을 주는 경우가 있고, 버킷
  //    `allowed_mime_types`는 그 빈 값을 `application/octet-stream`으로 보고 거부한다
  //    (`docError`가 이미 통과시켰으므로 여기서 null이 아니다).
  // ⚠️ **`contentType` 옵션으로는 안 고쳐진다** — supabase-js는 본문이 `Blob`/`File`이면 그것을
  //    FormData로 감싸 보내고 그 옵션을 쓰지 않는다(`StorageFileApi` 실측). 서버는 **파일 자신의
  //    `type`**을 읽으므로, 타입이 다르면 그 타입을 가진 `File`을 새로 만들어 올린다.
  const mime = docMime(doc!)!;
  const body = doc!.type === mime ? doc! : new File([doc!], doc!.name, { type: mime });
  const path = `${user.id}/${randomUUID()}.${docExtension(mime)}`;
  const { error: uploadError } = await createServiceClient()
    .storage.from(DOC_BUCKET)
    .upload(path, body, { contentType: mime, upsert: false });
  if (uploadError) {
    console.error("[verify] 증빙 업로드 실패", uploadError);
    return { message: "서류를 올리지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  const church = found
    ? { id: found.id, created: false }
    : await createChurch(supabase, registrationNo, text);
  if (church === null) {
    await removeDoc(path);
    return { message: "접수하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  const previousDoc = await saveApplication(supabase, user.id, church.id, path, text);
  if (previousDoc === "error") {
    await removeDoc(path);
    // ⚠️ **우리가 만든 행일 때만 되돌린다.** 남기면 다음 시도가 "기존 교회" 분기를 타서, 처음에
    //    잘못 적은 교회명·지역을 **다시 고칠 방법이 없어진다**(그 분기는 교회 칸을 보여주지도 않는다).
    //    ⚠️ `found === null`로 판정하면 안 된다 — UNIQUE 경합으로 **남이 방금 만든 행에 붙은**
    //    경우가 그 조건을 통과해, 남의 교회를 지우게 된다. `created`는 INSERT가 실제로 됐을 때만 참이다.
    if (church.created) await removeChurch(supabase, church.id);
    return { message: "접수하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  // 재신청이면 옛 서류를 지운다 — 안 지우면 파기 경로 없는 개인정보가 쌓인다(/privacy §3)
  if (previousDoc !== null) await removeDoc(previousDoc);

  // ⛔ `updateTag`을 부르지 않는다 — 캐시된 교회 조회는 전부 `verification_status='APPROVED'`로
  //    거르므로(`lib/queries/churches.ts`) 방금 만든 `PENDING` 행을 볼 수 있는 cached read가 없다.
  //    승인은 운영자가 DB에서 직접 하고, 그때는 `/admin`의 "공개 목록 새로고침"이 캐시를 비운다.
  return {};
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** 우리가 만든 교회 행 되돌리기 — 실패해도 흐름을 막지 않는다(고아 행은 `PENDING`이라 공개되지 않는다) */
async function removeChurch(supabase: ServerClient, churchId: string): Promise<void> {
  const { error } = await supabase.from("churches").delete().eq("id", churchId);
  if (error) console.error("[verify] 교회 행 되돌리기 실패", churchId, error);
}

/**
 * 처음 등록하는 교회 — 행을 먼저 만들고 `users.church_id`가 그것을 가리킨다(DATA §3 경로 ①).
 * ⚠️ UNIQUE 충돌(`23505`)은 **에러가 아니라 "그 사이 누가 먼저 만들었다"**는 뜻이라 다시 조회해 붙는다.
 */
async function createChurch(
  supabase: ServerClient,
  registrationNo: string,
  text: (name: string) => string,
): Promise<{ id: string; created: boolean } | null> {
  const denomination = parseDenomination(text("denomination"));
  const { data, error } = await supabase
    .from("churches")
    .insert({
      registration_no: registrationNo,
      name: text("churchName").trim(),
      denomination: denomination === "invalid" ? null : denomination,
      region: text("region"),
      city: blankToNull(text("city")),
      address: blankToNull(text("address")),
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const { data: raced } = await supabase
      .from("churches")
      .select("id")
      .eq("registration_no", registrationNo)
      .maybeSingle();
    // 그 사이 남이 만든 행이다 — 우리 것이 아니므로 되돌리지 않는다
    return raced === null ? null : { id: raced.id, created: false };
  }
  if (error) {
    console.error("[verify] 교회 생성 실패", error);
    return null;
  }
  return { id: data.id, created: true };
}

/**
 * 신청 기록. **동의와 접수를 한 UPDATE로 쓴다** — 나눠 쓰면 `users_submitted_needs_consent`가
 * 첫 번째를 거부한다(동의 없는 접수가 존재할 수 없다).
 *
 * 반환값은 **이전 증빙 경로**다(없으면 `null`). 재신청이면 그 파일을 지워야 하고, 그 판단에
 * 필요한 값을 이 왕복에서 함께 받아 온다.
 */
async function saveApplication(
  supabase: ServerClient,
  userId: string,
  churchId: string,
  docPath: string,
  text: (name: string) => string,
): Promise<string | null | "error"> {
  // ⚠️ **덮어쓰기 전에 읽어야 한다** — UPDATE가 돌려주는 것은 새 값이라, 여기서 안 읽으면
  //    재신청의 옛 서류를 영영 못 찾는다(파기 경로가 없는 개인정보로 남는다).
  const { data: before, error: readError } = await supabase
    .from("users")
    .select("verification_doc_path")
    .eq("id", userId)
    .maybeSingle();
  if (readError) {
    console.error("[verify] 이전 신청 조회 실패", readError);
    return "error";
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("users")
    .update({
      church_id: churchId,
      church_verification_status: "PENDING",
      verification_doc_path: docPath,
      verification_applicant_name: text("applicantName").trim(),
      verification_applicant_position: text("position"),
      verification_contact_tel: text("contactTel").trim(),
      verification_contact_email: blankToNull(text("contactEmail")),
      // 한 시각을 두 칸에 쓴다 — 두 번 만들면 접수와 동의가 미세하게 어긋난 값으로 남는다
      verification_submitted_at: now,
      verification_consent_at: now,
      // **방침** 시행일을 쓴다 — 이 칸이 답해야 하는 것은 "어떤 개인정보처리방침에 동의했나"다
      verification_consent_version: PRIVACY_EFFECTIVE_DATE,
      // 재신청이면 이전 반려 사유를 지운다 — 남기면 검수 화면이 옛 사유를 새 신청에 붙여 보여준다
      verification_rejection_reason: null,
      verification_reviewed_at: null,
    })
    .eq("id", userId)
    .select("id");

  if (error) {
    console.error("[verify] 신청 기록 실패", error);
    return "error";
  }
  // 0행 UPDATE는 PostgREST에서 성공으로 온다 — 행이 없으면 신청이 저장되지 않은 것이다
  if (data.length === 0) {
    console.error("[verify] 신청 기록 실패 — users 행 없음", userId);
    return "error";
  }
  // 새 경로와 같으면 지울 것이 없다(같을 일은 없지만, 지우면 방금 올린 파일을 지운다)
  const previous = before?.verification_doc_path ?? null;
  return previous === docPath ? null : previous;
}

/** 서류 삭제 — 실패해도 사용자 흐름을 막지 않는다(고아 파일은 로그로 남긴다) */
async function removeDoc(path: string): Promise<void> {
  const { error } = await createServiceClient().storage.from(DOC_BUCKET).remove([path]);
  if (error) console.error("[verify] 증빙 삭제 실패", path, error);
}
