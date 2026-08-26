import { DENOMINATIONS, POSITIONS, REGIONS, type Denomination } from "@/constants/domain";
import { keyOf } from "@/lib/domain-enum";

// 교회 인증 신청의 **순수 규칙** — 화면과 액션이 같은 답을 쓴다(`review-edits`·`job-edits`와 같은 자리).
// 서버 전용 import가 없어 양쪽에서 쓸 수 있고, **판정은 액션이 한다**(신뢰 경계).
// 화면이 쓰는 것은 **입력 정규화·파일 검사·길이 상한**뿐이다 — 칸 검증(`churchDraftErrors`·
// `applicantDraftErrors`)은 서버만 부른다. 브라우저는 `required`·`maxLength`·`type`으로 먼저 막고,
// 그것을 지나온 값(공백만 입력·숫자 없는 전화)은 서버가 사람 말로 되돌려 준다.

/** 고유번호 자릿수 — 고유번호증·사업자등록증 공통(3-2-5 표기, 저장은 숫자만) */
export const REGISTRATION_NO_LENGTH = 10;

/**
 * 증빙 서류 최대 크기.
 *
 * ⚠️ **버킷은 10MB를 허용하지만 4MB로 막는다** — Vercel Function의 **요청 본문 한도가 4.5MB**이고
 *    초과하면 플랫폼이 함수에 닿기도 전에 `413 FUNCTION_PAYLOAD_TOO_LARGE`를 낸다(공식 문서
 *    `/docs/functions/limitations`). 파일이 Server Action 본문으로 올라오는 구조라 그 한도가
 *    그대로 우리 한도다. 폼 나머지 칸까지 들어갈 여유를 두고 4MB로 잡았다.
 * ⚠️ **로컬에서는 재현되지 않는 종류다** — `next.config.ts`의 `bodySizeLimit`을 4.5mb로 맞춰
 *    개발에서도 같은 벽에 부딪히게 해 두었다.
 * 10MB를 정말 받으려면 업로드를 **브라우저 → Storage 직행(signed upload URL)**으로 옮겨야 한다.
 *    그러면 함수 본문을 지나지 않으므로 버킷 한도가 유일한 상한이 된다.
 */
/**
 * 증빙 서류 비공개 버킷 — 신청(업로드)과 검수(서명 열람·반려 시 파기)가 **같은 이름을 써야** 한다.
 * 서류에 관한 사실(상한·허용 형식·확장자·버킷·수명)을 이 파일 하나에 모아 둔다.
 */
export const DOC_BUCKET = "verification-docs";

/** 검수 화면이 서류를 여는 signed URL 수명 — 포스터와 같은 30분(운영자가 한 건 보는 시간) */
export const DOC_URL_TTL_SECONDS = 60 * 30;

/**
 * 반려 사유 상한 — 신청자에게 그대로 보여 주는 글이라 화면에 담길 만큼만 받는다.
 * ⚠️ **검수 화면이 쓰는 값인데 여기 있다**: `"use server"` 파일은 async 함수만 내보낼 수 있어
 *    (실측 2026-08-25 · 빌드는 통과하고 요청에서 터진다) 액션 옆에 둘 수 없다.
 */
export const REJECTION_REASON_MAX = 200;

export const DOC_MAX_BYTES = 4 * 1024 * 1024;

/**
 * 고유번호 정규화 — **숫자만 남긴다.**
 *
 * ⚠️ 하이픈을 그대로 저장하면 `123-45-67890`과 `1234567890`이 서로 다른 교회가 되어
 *    `churches.registration_no`의 UNIQUE가 무의미해진다. 입력창도 이 함수를 써서
 *    붙여넣은 값을 즉시 정리한다(화면과 서버가 같은 규칙을 쓴다).
 */
export function normalizeRegistrationNo(input: string): string {
  return input.replace(/\D/g, "").slice(0, REGISTRATION_NO_LENGTH);
}

export function registrationNoError(input: string): string | null {
  const digits = normalizeRegistrationNo(input);
  if (digits.length === 0) return "고유번호를 적어 주세요.";
  if (digits.length < REGISTRATION_NO_LENGTH)
    return `숫자 ${REGISTRATION_NO_LENGTH}자리로 적어 주세요.`;
  return null;
}

/** 칸 이름 → 사람이 읽는 오류. 비어 있으면 통과다 */
export type FieldErrors = Record<string, string>;

/**
 * 칸 길이 상한 — **폼의 `maxLength`와 서버 검증이 같은 값을 쓴다.**
 *
 * ⚠️ 서버에서도 봐야 한다: 이 액션은 파일 때문에 본문 한도가 크고, `text` 컬럼에는 길이 제약이
 *    없다. 조작된 POST 하나로 교회명·연락처에 수십만 자가 들어갈 수 있다.
 */
export const MAX_LENGTHS = {
  churchName: 60,
  city: 30,
  address: 120,
  applicantName: 30,
  contactTel: 30,
  contactEmail: 100,
} as const;

/** 너무 길면 오류 — 사용자는 `maxLength`에 막혀 여기 닿지 않는다(조작된 요청만 닿는다) */
function tooLong(value: string, limit: number): boolean {
  return value.trim().length > limit;
}

/**
 * 빈 값 정규화 — 선택 칸은 `""`가 아니라 `null`로 저장한다.
 *
 * ⚠️ `""`를 넣으면 "값이 있다"로 읽는 코드와 어긋난다. 특히 `naverMapUrl`은 주소를 truthy로
 *    검사해 폴백을 고르므로, 빈 문자열 주소는 지도 링크를 통째로 없애지도 못하고 남긴다.
 */
export function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * "무소속·독립교회"를 뜻하는 **화면 전용 select 값** — 저장값은 `null`이다(DATA §3).
 * `ETC`("소속은 있고 우리 9키에 없는 교단")와 섞으면 필터·거점 판정이 오염된다.
 */
export const DENOMINATION_INDEPENDENT = "INDEPENDENT";

/** 폼의 교단 select 값 → 저장값 */
export function parseDenomination(raw: string): Denomination | null | "invalid" {
  if (raw === DENOMINATION_INDEPENDENT) return null;
  return keyOf(DENOMINATIONS, raw) ?? "invalid";
}

/**
 * 교회 정보 검증 — **처음 등록하는 교회일 때만** 부른다.
 * 기존 교회면 이 칸들을 받지도 않는다(미승인 신청자가 인증된 교회 값을 덮어쓸 수 없다 · DATA §3).
 */
export function churchDraftErrors(input: {
  registrationNo: string;
  name: string;
  denomination: string;
  region: string;
  city: string;
  address?: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const regNo = registrationNoError(input.registrationNo);
  if (regNo) errors.registrationNo = regNo;
  // ⚠️ trim 후에 본다 — `NOT NULL`은 `''`를 막지 못한다(`churches_name_not_blank`가 같이 막는다)
  if (blankToNull(input.name) === null) errors.name = "교회명을 적어 주세요.";
  else if (tooLong(input.name, MAX_LENGTHS.churchName)) errors.name = "교회명이 너무 길어요.";
  if (parseDenomination(input.denomination) === "invalid")
    errors.denomination = "교단을 골라 주세요.";
  if (keyOf(REGIONS, input.region) === null) errors.region = "지역을 골라 주세요.";
  if (blankToNull(input.city) === null) errors.city = "시·군·구를 적어 주세요.";
  else if (tooLong(input.city, MAX_LENGTHS.city)) errors.city = "시·군·구가 너무 길어요.";
  if (tooLong(input.address ?? "", MAX_LENGTHS.address)) errors.address = "주소가 너무 길어요.";
  return errors;
}

/**
 * 담당자·연락처 검증. **형식은 느슨하게 본다** — 사무용 전화는 `02)000-0000`·내선 표기가
 * 실재하고, 엄격한 정규식은 진짜 교회를 막는다. 대조는 운영자가 공개 출처와 눈으로 한다(DATA §3).
 */
export function applicantDraftErrors(input: {
  applicantName: string;
  position: string;
  contactTel: string;
  contactEmail: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (blankToNull(input.applicantName) === null) errors.applicantName = "이름을 적어 주세요.";
  else if (tooLong(input.applicantName, MAX_LENGTHS.applicantName))
    errors.applicantName = "이름이 너무 길어요.";
  if (keyOf(POSITIONS, input.position) === null) errors.position = "직분을 골라 주세요.";
  const tel = blankToNull(input.contactTel);
  if (tel === null) errors.contactTel = "사무용 전화를 적어 주세요.";
  else if (tooLong(tel, MAX_LENGTHS.contactTel)) errors.contactTel = "전화번호가 너무 길어요.";
  else if (!/\d/.test(tel)) errors.contactTel = "전화번호를 확인해 주세요.";
  const email = blankToNull(input.contactEmail);
  // 선택 칸이라 비어 있으면 통과. 적었으면 최소한 주소 꼴이어야 한다
  if (email !== null && tooLong(email, MAX_LENGTHS.contactEmail))
    errors.contactEmail = "이메일이 너무 길어요.";
  else if (email !== null && !email.includes("@")) errors.contactEmail = "이메일을 확인해 주세요.";
  return errors;
}

/**
 * 받는 형식 — **운영자가 화면에서 읽을 수 있는 것만** 둔다. 검수는 서류를 띄워 놓고 값과
 * 대조하는 일이라, 못 띄우는 형식을 받으면 신청자는 올렸는데 판정이 막히고 결국
 * 반려 → 재신청 한 바퀴를 돌게 된다.
 *
 * ⛔ **HEIC·HEIF를 뺐다**(2026-08-26) — Chrome·Firefox가 렌더링하지 못한다. 아이폰은 대체로
 *    영향이 없다(iOS가 `<input type="file">` 업로드에서 JPEG로 바꿔 보낸다); 걸리는 쪽은 맥에서
 *    `.heic`를 직접 고르는 경우고, 그때는 `docError`가 사람 말로 거절한다.
 * ⚠️ 버킷 `allowed_mime_types`는 이보다 넓어도 된다(우리가 먼저 거른다). 좁으면 업로드가
 *    서버에서 조용히 거부된다.
 */
const DOC_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

type DocMime = (typeof DOC_MIME_TYPES)[number];

/** 확장자 → MIME. 브라우저가 `file.type`을 비워 보낼 때 쓰는 폴백이다 */
const EXTENSION_MIME: Record<string, DocMime> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * 파일 선택창의 `accept` — **확장자 맵에서 만든다.** 손으로 적으면 목록이 세 곳(버킷 MIME ·
 * 확장자 폴백 · 이 문자열)으로 흩어지고, `accept`만 넓어지면 초대해 놓고 거절하는 모양이 된다.
 */
export const DOC_ACCEPT = Object.keys(EXTENSION_MIME)
  .map((extension) => `.${extension}`)
  .join(",");

/**
 * 화면에 적는 형식 목록("PDF · JPG · PNG · WEBP") — **MIME 목록에서 파생한다.**
 * 폼이 손으로 적고 있어서 HEIC를 뺀 뒤에도 `HEIC`가 남아 있었다: 못 받는 형식을 초대하는 안내다.
 */
export const DOC_FORMATS_LABEL = DOC_MIME_TYPES.map((mime) =>
  docExtension(mime).toUpperCase(),
).join(" · ");

export interface DocInput {
  size: number;
  type: string;
  name: string;
}

/**
 * 증빙 서류의 MIME — **파일명 확장자로 폴백한다.**
 *
 * ⚠️ **브라우저가 `file.type`을 빈 문자열로 주는 경우가 있다**(OS·확장자 등록 상태에 따라).
 *    폴백 없이 MIME만 보면 우리가 `accept`로 초대해 놓고 거절하는 모양이 된다. HEIC를 받던 동안
 *    그게 흔한 경우였고(2026-08-26에 형식에서 뺐다), 드물게 다른 형식에서도 나므로 폴백은 남긴다.
 *    업로드할 때도 이 값을 `contentType`으로 넘겨야 한다 — 버킷 `allowed_mime_types` 안이어야 통과한다.
 * 모르는 형식이면 `null`(호출부가 사람 말로 거절한다).
 */
export function docMime(file: DocInput): DocMime | null {
  if (DOC_MIME_TYPES.includes(file.type as DocMime)) return file.type as DocMime;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[extension] ?? null;
}

/** 증빙 서류 검증 — 버킷·플랫폼이 거부하기 전에 사람이 읽을 말로 알려준다 */
export function docError(file: DocInput | null): string | null {
  if (file === null || file.size === 0) return "증빙 서류를 올려 주세요.";
  if (file.size > DOC_MAX_BYTES) return `${DOC_MAX_BYTES / 1024 / 1024}MB 이하 파일로 올려 주세요.`;
  if (docMime(file) === null) return "PDF 또는 이미지 파일로 올려 주세요.";
  return null;
}

/** 저장 경로 확장자 — MIME에서 뽑는다(파일명은 사용자 입력이라 경로에 넣지 않는다) */
export function docExtension(mime: DocMime): string {
  if (mime === "application/pdf") return "pdf";
  return mime.replace("image/", "").replace("jpeg", "jpg");
}
