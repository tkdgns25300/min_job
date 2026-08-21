import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  JOB_KINDS,
  PAY_PERIODS,
  POSITIONS,
  REGIONS,
  type Denomination,
  type Department,
  type EmploymentType,
  type JobKind,
  type PayPeriod,
  type Position,
  type Region,
} from "@/constants/domain";
import { DENOMINATION_SOURCES, type DenominationSource } from "@/constants/review";
import type { GapInput } from "@/lib/review-flags";
import type { Tables } from "@/types/database";

// 단건 검수가 **고칠 수 있는 칸**과 그 칸들이 지켜야 하는 짝 규칙 — 순수 함수.
//
// 화면(초안 만들기·게이트 표시)과 Server Action(저장 전 검사)이 같은 규칙을 봐야 하므로 lib에 둔다.
// 컬럼명은 snake_case — `lib/queries/review.ts` 머리말의 예외를 그대로 따른다(크롤러 소유 테이블).

/**
 * 고칠 수 있는 칸. `GapInput`을 확장하므로 **초안에 그대로 `promotionGaps`를 걸 수 있다** —
 * 승인 게이트가 저장된 행과 고치는 중인 초안에서 같은 답을 낸다.
 *
 * ⚠️ **여기 없는 칸은 원문 값이 그대로 공개된다**(요건·우대·제출서류·전형절차 배열, 근무일,
 *    모집인원, 시작시기, 자격, 복리후생, 주소). 편집칸을 안 만든 이유는 셋 다다: 목록 표시용이라
 *    틀려도 사고가 없고, 칸이 늘면 한 건에 드는 시간이 늘어 큐가 밀리고, 잘못된 값은 거절로
 *    걸러도 된다. 대신 화면은 그 값들을 **읽기 전용으로 보여준다** — 승인 판단에는 보이는 것이 필요하다.
 */
export interface ReviewEdits extends GapInput {
  job_kind: JobKind[];
  position: Position[];
  region: Region | null;
  city: string | null;
  denomination: Denomination | null;
  denomination_source: DenominationSource;
  department: Department | null;
  employment_type: EmploymentType | null;
  housing_provided: boolean | null;
  housing_note: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_period: PayPeriod | null;
  pay_note: string | null;
  deadline: string | null;
}

/**
 * 닫힌 라벨 맵의 키만 통과 — DB CHECK가 이미 막지만, 타입을 좁히려면 런타임 확인이 필요하다.
 * `<select>`가 주는 문자열을 받는 화면 쪽도 이걸 쓴다 — 캐스트로 우기는 대신 모르는 값을 `null`로 만든다.
 */
export function keyOf<K extends string>(map: Record<K, string>, value: string | null): K | null {
  return value !== null && value in map ? (value as K) : null;
}

function keysOf<K extends string>(map: Record<K, string>, values: string[]): K[] {
  return values.filter((v): v is K => v in map);
}

/**
 * 저장된 행 → 편집 초안.
 *
 * ⚠️ `denomination`은 DB에 `'UNKNOWN'`이 들어올 수 있다(크롤러 CHECK의 11번째 값). 우리 라벨 맵엔
 *    없는 키라 `keyOf`가 걸러 **null(미상)** 이 된다 — 화면에서 "미상"과 같은 칸으로 다뤄야 맞다.
 */
export function toEdits(row: Tables<"review_data">): ReviewEdits {
  return {
    church_name: row.church_name,
    title: row.title,
    job_kind: keysOf(JOB_KINDS, row.job_kind),
    position: keysOf(POSITIONS, row.position),
    role: row.role,
    description: row.description,
    contact_email: row.contact_email,
    contact_tel: row.contact_tel,
    contact_link: row.contact_link,
    contact_post: row.contact_post,
    region: keyOf(REGIONS, row.region),
    city: row.city,
    denomination: keyOf(DENOMINATIONS, row.denomination),
    denomination_source: keyOf(DENOMINATION_SOURCES, row.denomination_source) ?? "unknown",
    department: keyOf(DEPARTMENTS, row.department),
    employment_type: keyOf(EMPLOYMENT_TYPES, row.employment_type),
    housing_provided: row.housing_provided,
    housing_note: row.housing_note,
    pay_min: row.pay_min,
    pay_max: row.pay_max,
    pay_period: keyOf(PAY_PERIODS, row.pay_period),
    pay_note: row.pay_note,
    deadline: row.deadline,
  };
}

/**
 * 교단을 고른 결과 — 값과 **판정 근거를 함께** 돌려준다.
 *
 * 근거를 따로 두면 둘이 어긋나 CHECK(`review_data_source_requires_denomination`)에 걸리거나,
 * 더 나쁘게는 통과하고서 **화면엔 교단이 보이는데 공개된 공고엔 비는** 상태가 된다
 * (크롤러는 `stated`·`registry`·`operator`만 내보낸다 · constants/review).
 * 원래 값을 그대로 되돌려 놓았다면 근거도 원래대로 — 손대지 않은 것을 "사람이 확정"으로 바꾸면
 * 크롤러 판정의 정확도를 우리가 부풀리는 셈이 된다.
 */
export function denominationChoice(
  next: Denomination | null,
  original: Pick<ReviewEdits, "denomination" | "denomination_source">,
): Pick<ReviewEdits, "denomination" | "denomination_source"> {
  if (next === null) return { denomination: null, denomination_source: "unknown" };
  if (next === original.denomination) {
    return { denomination: next, denomination_source: original.denomination_source };
  }
  return { denomination: next, denomination_source: "operator" };
}

/** 공백만 남은 입력은 값이 아니다 — `''`는 게이트를 속이고(`Boolean('')`은 false지만 `Boolean(' ')`은 true) DB에도 쓰레기가 남는다 */
export function blankToNull(value: string | null): string | null {
  return value === null ? null : value.trim() || null;
}

/** 텍스트 칸을 다듬은 초안. 화면(게이트 표시)과 Server Action(저장)이 같은 것을 봐야 한다 */
export function normalizeEdits(e: ReviewEdits): ReviewEdits {
  return {
    ...e,
    church_name: blankToNull(e.church_name),
    title: blankToNull(e.title),
    role: blankToNull(e.role),
    description: blankToNull(e.description),
    contact_email: blankToNull(e.contact_email),
    contact_tel: blankToNull(e.contact_tel),
    contact_link: blankToNull(e.contact_link),
    contact_post: blankToNull(e.contact_post),
    city: blankToNull(e.city),
    housing_note: blankToNull(e.housing_note),
    pay_note: blankToNull(e.pay_note),
  };
}

/**
 * 저장 전 짝 검사 — 통과하지 못하면 사람이 읽을 문장을 돌려준다(`null`이면 이상 없음).
 *
 * DB CHECK와 겹치지만 **여기서 먼저 잡는 이유**는 제약 이름(`review_data_kind_matches_seat`)만으론
 * 무엇을 어떻게 고쳐야 하는지 알 수 없기 때문이다. 화면이 짝을 자동으로 맞추므로 평소엔 통과한다 —
 * 여기 걸리면 화면 쪽 버그이거나 직접 만든 요청이다.
 */
export function editsError(e: ReviewEdits): string | null {
  const wantsMinistry = e.job_kind.includes("MINISTRY");
  const wantsGeneral = e.job_kind.includes("GENERAL");
  const hasRole = e.role !== null;

  // 크롤러 CHECK `review_data_kind_matches_seat` — 양방향(⟺)이다. 한쪽만 채우면 저장이 안 된다.
  if (wantsMinistry !== e.position.length > 0) {
    return "사역직과 직분은 짝입니다 — 사역직을 고르면 직분도 고르고, 직분을 지우면 사역직도 빼 주세요.";
  }
  if (wantsGeneral !== hasRole) {
    return "일반직과 직무명은 짝입니다 — 일반직을 고르면 직무명을 적고, 직무명을 지우면 일반직도 빼 주세요.";
  }
  // 크롤러 CHECK `review_data_source_requires_denomination`
  if ((e.denomination === null) !== (e.denomination_source === "unknown")) {
    return "교단과 판정 근거는 짝입니다 — 둘이 함께 채워지거나 함께 비어 있어야 합니다.";
  }
  if ((e.pay_min ?? 0) < 0 || (e.pay_max ?? 0) < 0) {
    return "사례비는 0 이상이어야 합니다.";
  }
  if (e.pay_min !== null && e.pay_max !== null && e.pay_min > e.pay_max) {
    return "사례비 최소가 최대보다 큽니다.";
  }
  // DB보다 **우리가 더 엄격한 유일한 칸**. `jobs.pay_period`는 NOT NULL DEFAULT 'MONTH'라
  // 주기 없이 금액만 공개하면 **연봉이 월급으로** 나간다(크롤러도 같은 이유로 금액을 함께 비운다).
  if ((e.pay_min !== null || e.pay_max !== null) && e.pay_period === null) {
    return "사례비 금액이 있으면 주기(월·연)를 함께 골라 주세요 — 주기가 없으면 연봉이 월급으로 공개됩니다.";
  }
  return null;
}

/** 배열은 원소로 비교한다 — 참조 비교면 매번 "바뀌었다"가 된다 */
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }
  return a === b;
}

/**
 * 초안에서 **실제로 바뀐 칸만**.
 *
 * 안 바꾼 칸까지 함께 쓰면, 운영자가 화면을 연 뒤 크롤러가 재구조화한 값을 **손댄 적 없는 칸까지
 * 통째로 덮어쓴다**. 바뀐 칸만 보내면 그 사고 범위가 "내가 고친 칸"으로 줄고, 그래도 짝이 어긋나면
 * DB CHECK가 막아 준다(조용히 틀리는 것보다 낫다).
 *
 * 짝(`job_kind`↔`position`·`role`, `denomination`↔`denomination_source`)은 화면 컨트롤이 언제나
 * 함께 움직이므로 한쪽만 빠지는 일이 없다.
 */
export function changedEdits(edits: ReviewEdits, original: ReviewEdits): Partial<ReviewEdits> {
  // Object.fromEntries는 타입을 잃는다 — 값의 출처가 같은 타입의 `edits`라 되돌려 붙여도 안전하다
  return Object.fromEntries(
    Object.entries(edits).filter(
      ([key, value]) => !same(value, original[key as keyof ReviewEdits]),
    ),
  ) as Partial<ReviewEdits>;
}
