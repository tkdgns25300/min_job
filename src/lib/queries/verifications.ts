import {
  CHURCH_STATUSES,
  CHURCH_VERIFICATION_STATUSES,
  type ChurchStatus,
  type ChurchVerificationStatus,
  DENOMINATIONS,
  POSITIONS,
  REGIONS,
} from "@/constants/domain";
import { keyOf } from "@/lib/domain-enum";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "./fetch-all";
import type { Tables } from "@/types/database";
import type { ChurchVerification, QueueSummary } from "@/types/domain";

// 데이터 소스 seam (교회 인증) — 페이지는 여기서만 가져온다.
//
// ⚠️ 인증 의존(operator 전용) + PII(담당자 실명·직분·연락처) — **`'use cache'` 금지**(가드레일 #3).
//    공개 공고와 달리 캐시 이득이 없고 개인정보를 공유 캐시에 두는 위험만 있다. 쿠키 세션 `server.ts`.
//
// ⚠️ **`church_verifications` 테이블은 없다.** 신청 한 건은 두 곳에 나뉘어 있다(DATA §3):
//    담당자·서류·처리 시각은 `users.verification_*`, 교회 자체는 `churches` 행(신규 교회로
//    적어내면 그 순간 `PENDING` 행이 먼저 생기고 `users.church_id`가 그걸 가리킨다).
//    그래서 이 함수는 **조인 결과를 화면용 모양으로 조립**한다.

/** 신청서가 성립하는 최소 조건 — 담당자 정보와 교회 행이 함께 있어야 한다 */
const SELECT = `
  id, email, verification_applicant_name, verification_applicant_position,
  verification_contact_tel, verification_contact_email, verification_doc_path,
  verification_submitted_at, verification_reviewed_at, verification_rejection_reason,
  church_verification_status,
  churches!inner(id, name, denomination, region, city, verification_status)
`;

type ApplicantRow = Pick<
  Tables<"users">,
  | "id"
  | "email"
  | "verification_applicant_name"
  | "verification_applicant_position"
  | "verification_contact_tel"
  | "verification_contact_email"
  | "verification_doc_path"
  | "verification_submitted_at"
  | "verification_reviewed_at"
  | "verification_rejection_reason"
  | "church_verification_status"
> & {
  churches: Pick<
    Tables<"churches">,
    "id" | "name" | "denomination" | "region" | "city" | "verification_status"
  >;
};

/**
 * 교회 인증 신청 — 운영자 검수 목록(유일한 검수 게이트). 작업 큐 정렬:
 * 검수 대기(PENDING) 먼저(오래된 신청 우선), 처리 완료는 최근 처리 순.
 *
 * ⚠️ `verification_submitted_at`이 빈 행은 **신청이 아니다** — 로그인만 한 계정도 `users` 행을
 *    갖는다(`auth/callback`이 만든다). 제출 시각으로 걸러야 검수 큐가 전체 회원 목록이 되지 않는다.
 * ⚠️ `churches!inner` — 교회 행이 없는 신청은 성립하지 않는다(DATA §3 경로 ①: 신청 시 행이 먼저 생긴다).
 */
export async function getVerifications(): Promise<ChurchVerification[]> {
  const supabase = await createClient();
  // 테이블 전체를 훑으므로 페이지를 이어 붙인다(1,000행 상한 · fetch-all)
  const rows = await fetchAllRows<ApplicantRow>("인증 신청", (from, to) =>
    supabase
      .from("users")
      .select(SELECT, { count: "exact" })
      .not("verification_submitted_at", "is", null)
      .order("id")
      .range(from, to),
  );
  return rows.map(toVerification).sort(byReviewQueue);
}

/**
 * 신청 상태 — **`church_verification_status`는 nullable이다**(마이그레이션). 로그인만 한 계정은
 * 비어 있고, 제출은 됐는데 상태가 비어 있으면 **아직 판정 전**으로 읽는다. 목록·요약이 같은 답을
 * 써야 홈의 "N건 대기"와 검수 화면의 대기 탭이 어긋나지 않는다.
 */
function applicationStatus(value: string | null): ChurchVerificationStatus {
  return keyOf(CHURCH_VERIFICATION_STATUSES, value) ?? "PENDING";
}

/**
 * 교회 행의 검증 상태 — **값 집합이 위와 다르다**(거부는 사람 쪽에만 있다 · `CHURCH_STATUSES`).
 * 좁히기 실패의 기본값은 덜 보이는 쪽이다: 모르는 값을 `APPROVED`로 읽으면 미검증 교회가 노출된다.
 */
function churchStatus(value: string): ChurchStatus {
  return keyOf(CHURCH_STATUSES, value) ?? "PENDING";
}

type QueueRow = Pick<Tables<"users">, "verification_submitted_at" | "church_verification_status">;

/**
 * 인증 검수 큐 — 대기 건수와 가장 오래 기다린 신청(운영자 홈).
 *
 * ⚠️ **`getVerifications()`가 세는 것과 같은 행을 세야 한다** — 조건이 갈리면 "1건 대기"를 눌렀는데
 *    아무것도 없는 화면이 나온다. 그래서 필터(제출 시각 + `churches!inner`)와 상태 판정
 *    (`applicationStatus`)을 **그대로 공유**하고, 세는 일만 JS에서 한다.
 * ⚠️ 담당자 실명·연락처는 **읽지 않는다** — 숫자 둘 때문에 PII를 가져올 이유가 없다(가드레일 #3).
 */
export async function getVerificationQueueSummary(): Promise<QueueSummary> {
  const supabase = await createClient();
  const rows = await fetchAllRows<QueueRow>("인증 검수 큐", (from, to) =>
    supabase
      .from("users")
      .select("verification_submitted_at, church_verification_status, churches!inner(id)", {
        count: "exact",
      })
      .not("verification_submitted_at", "is", null)
      .order("id")
      .range(from, to),
  );
  // 제출 시각은 SQL이 이미 걸렀지만 생성 타입은 nullable이라 가드로 좁힌다
  const waiting = rows
    .filter((row) => applicationStatus(row.church_verification_status) === "PENDING")
    .map((row) => row.verification_submitted_at)
    .filter((at): at is string => at !== null);
  return {
    count: waiting.length,
    oldestAt: waiting.reduce<string | null>((a, b) => (a === null || b < a ? b : a), null),
  };
}

function toVerification(row: ApplicantRow): ChurchVerification {
  const church = row.churches;
  return {
    // 신청 한 건 = 사용자 한 명이다(재신청은 같은 행을 다시 쓴다 · DATA §3) → 사용자 id가 신청 id다
    id: row.id,
    applicant: {
      name: row.verification_applicant_name ?? "",
      // 직분은 닫힌 목록이지만 저장은 text다 — 모르는 값이면 '기타'로 둔다(신청 자체를 버리지 않는다)
      position: keyOf(POSITIONS, row.verification_applicant_position) ?? "ETC",
      email: row.email,
    },
    church: {
      id: church.id,
      verificationStatus: churchStatus(church.verification_status),
      name: church.name,
      denomination: keyOf(DENOMINATIONS, church.denomination),
      region: keyOf(REGIONS, church.region),
      city: church.city,
      // ⚠️ **신청자가 적어낸 사무용 연락처**다 — `churches`에서 조인한 값이 아니다.
      //    기존 교회 신청이면 교회 행의 값과 다를 수 있고, 그 차이가 곧 반려 근거다(DATA §3).
      contactEmail: row.verification_contact_email,
      contactTel: row.verification_contact_tel,
    },
    // 경로만 저장하고 파일명을 따로 두지 않는다 — 경로의 마지막 조각이 곧 파일명이다.
    // `null` = 파기 완료(처리 끝난 신청은 서류를 다시 열 수 없다 · 개인정보처리방침).
    docFileName: row.verification_doc_path?.split("/").at(-1) ?? null,
    status: applicationStatus(row.church_verification_status),
    // 위 쿼리가 null을 걸러냈으므로 값이 있다 — 타입만 nullable이다
    submittedAt: row.verification_submitted_at ?? "",
    reviewedAt: row.verification_reviewed_at,
    rejectionReason: row.verification_rejection_reason,
  };
}

/** 오프셋 있는 ISO8601 → 정렬용 시점(ms). 없으면 0(맨 뒤로 밀린다) */
function at(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

/**
 * 검수 대기 먼저(오래된 신청 우선), 처리 완료는 최근 처리 순.
 * ⚠️ 시각은 **시점으로** 비교한다 — ISO 문자열 비교는 오프셋 표기가 섞이면 틀린다
 *    (`2026-07-29T00:00+09:00`은 `2026-07-28T23:00Z`보다 이른데 문자열로는 뒤로 간다).
 */
function byReviewQueue(a: ChurchVerification, b: ChurchVerification): number {
  const aPending = a.status === "PENDING";
  const bPending = b.status === "PENDING";
  if (aPending !== bPending) return aPending ? -1 : 1;
  if (aPending) return at(a.submittedAt) - at(b.submittedAt);
  return at(b.reviewedAt) - at(a.reviewedAt);
}
