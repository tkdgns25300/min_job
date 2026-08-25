import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  JOB_KINDS,
  PAY_PERIODS,
  POSITIONS,
  QUALIFICATIONS,
  REGIONS,
  type Denomination,
  type Department,
  type EmploymentType,
  type JobKind,
  type PayPeriod,
  type Position,
  type Qualification,
  type Region,
} from "@/constants/domain";
import { keyOf, keysOf } from "@/lib/domain-enum";
import type { Tables } from "@/types/database";

// 공개된 공고를 운영자가 고칠 수 있는 칸과 그 칸들이 지켜야 하는 짝 규칙 — 순수 함수.
//
// 화면(막힌 이유 표시)과 Server Action(저장 전 검사)이 같은 규칙을 봐야 하므로 lib에 둔다.
// 컬럼명은 snake_case — `jobs` 컬럼에 그대로 UPDATE를 걸기 때문이다(역매핑을 만들면 CHECK 짝이
// 깨지는 자리가 두 배로 늘어난다 · `lib/review-edits.ts`와 같은 이유).
//
// ⚠️⚠️ **`lib/review-edits.ts`와 합치지 않는다.** 같은 칸을 다루지만 **제약이 다르다**:
//    | | `review_data`(검수) | `jobs`(공개된 공고) |
//    |---|---|---|
//    | 교단 근거 | `denomination_source`와 짝 | **그 컬럼이 없다** |
//    | 교단 `UNKNOWN` | CHECK가 허용 | **없다** → 미상은 `null` |
//    | 연락처 | 승격 게이트(경고) | **하드 CHECK**(`jobs_needs_contact`) |
//    | 종류 | 빈 배열 허용 | **`cardinality > 0` 필수**(`jobs_kind_matches_seat`) |
//    | 사례비 주기 | nullable | **NOT NULL DEFAULT 'MONTH'** |
//    | 최소~최대 | CHECK 있음 | **CHECK가 없다** → 우리가 막아야 한다 |
//    합치면 한쪽 규칙이 다른 쪽으로 조용히 새어 든다.

/**
 * 운영자가 고칠 수 있는 칸.
 *
 * ⚠️ **여기 없는 칸은 우리 것이 아니다.**
 *  · `posted_at` — 크롤러가 끌어올린다(크롤러 SPEC §4.2b: "`posted_at` 한 칸만 쓴다. 제목·연락처·
 *    마감일·상태는 운영자·교회의 몫"). 우리가 쓰면 다음 실행에 덮인다.
 *  · `source`·`source_url`·`church_id` — 출처와 소유권. 고치는 것이 아니라 claim으로 바뀐다.
 *  · `featured_tier`·`featured_until` — 결제 결과. 결제 경로가 붙을 때 그쪽이 쓴다.
 *  · `status` — **전용 버튼(마감·다시 모집)만** 쓴다. 같은 컬럼에 쓰기 경로가 둘이면 갈라진다.
 *  · `id`·`created_at`·`updated_at` — 관리 칸(`updated_at`은 저장 액션이 직접 넣는다 · 트리거 없음).
 */
export interface JobEdits {
  church_name: string;
  title: string;
  description: string;
  job_kind: JobKind[];
  position: Position[];
  role: string | null;
  department: Department | null;
  employment_type: EmploymentType | null;
  qualification: Qualification | null;
  denomination: Denomination | null;
  region: Region | null;
  city: string | null;
  address: string | null;
  housing_provided: boolean | null;
  housing_note: string | null;
  pay_min: number | null;
  pay_max: number | null;
  /** ⚠️ NOT NULL — 비울 수 없다. 금액이 없어도 주기는 남는다 */
  pay_period: PayPeriod;
  pay_note: string | null;
  deadline: string | null;
  headcount: string | null;
  start_timing: string | null;
  work_days: string | null;
  benefit_note: string | null;
  requirements: string[];
  preferred: string[];
  required_docs: string[];
  optional_docs: string[];
  process_steps: string[];
  contact_email: string | null;
  contact_tel: string | null;
  contact_link: string | null;
  contact_post: string | null;
}

/** 목록 칸 다섯의 키 — 화면이 같은 컨트롤을 다섯 번 그린다 */
export type EditableJobList =
  "requirements" | "preferred" | "required_docs" | "optional_docs" | "process_steps";

/**
 * 저장된 행 → 편집 초안.
 *
 * ⚠️ `church_name`·`title`·`description`은 DB에서 NOT NULL이라 그대로 받는다. 화면에서 비우면
 *    `editsError`가 막는다 — 빈 문자열로 UPDATE하면 CHECK가 없어 **그대로 저장되고 공개 화면이 빈다.**
 * ⚠️ enum은 `text + CHECK`라 생성 타입이 `string`이다. `keyOf`/`keysOf`로 좁히고, 좁히기가 실패하면
 *    `null`(=미상)이 된다 — 라벨 맵에 없는 값을 화면에 그리는 것보다 낫다(row-map과 같은 규칙).
 */
export function toJobEdits(row: Tables<"jobs">): JobEdits {
  return {
    church_name: row.church_name,
    title: row.title,
    description: row.description,
    job_kind: keysOf(JOB_KINDS, row.job_kind),
    position: keysOf(POSITIONS, row.position ?? []),
    role: row.role,
    department: keyOf(DEPARTMENTS, row.department),
    employment_type: keyOf(EMPLOYMENT_TYPES, row.employment_type),
    qualification: keyOf(QUALIFICATIONS, row.qualification),
    denomination: keyOf(DENOMINATIONS, row.denomination),
    region: keyOf(REGIONS, row.region),
    city: row.city,
    address: row.address,
    housing_provided: row.housing_provided,
    housing_note: row.housing_note,
    pay_min: row.pay_min,
    pay_max: row.pay_max,
    // NOT NULL DEFAULT 'MONTH' — 좁히기가 실패하면 그 기본값으로 읽는다(공개 화면이 그렇게 읽는다)
    pay_period: keyOf(PAY_PERIODS, row.pay_period) ?? "MONTH",
    pay_note: row.pay_note,
    deadline: row.deadline,
    headcount: row.headcount,
    start_timing: row.start_timing,
    work_days: row.work_days,
    benefit_note: row.benefit_note,
    requirements: row.requirements ?? [],
    preferred: row.preferred ?? [],
    required_docs: row.required_docs ?? [],
    optional_docs: row.optional_docs ?? [],
    process_steps: row.process_steps ?? [],
    contact_email: row.contact_email,
    contact_tel: row.contact_tel,
    contact_link: row.contact_link,
    contact_post: row.contact_post,
  };
}

/** 공백만 남은 입력은 값이 아니다 — `''`는 CHECK를 통과해 **공개 화면에 빈 칸으로 나간다** */
function blankToNull(value: string | null): string | null {
  return value === null ? null : value.trim() || null;
}

/** 빈 줄은 값이 아니다 — `[""]`가 남으면 공개 화면에 빈 항목이 그려진다 */
function cleanList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

/** 텍스트 칸을 다듬은 초안. 화면(막힌 이유)과 Server Action(저장)이 같은 것을 봐야 한다 */
export function normalizeJobEdits(e: JobEdits): JobEdits {
  return {
    ...e,
    // NOT NULL 셋은 다듬기만 한다 — 비면 `editsError`가 막고, null로 바꾸면 타입이 거짓이 된다
    church_name: e.church_name.trim(),
    title: e.title.trim(),
    description: e.description.trim(),
    role: blankToNull(e.role),
    city: blankToNull(e.city),
    address: blankToNull(e.address),
    housing_note: blankToNull(e.housing_note),
    pay_note: blankToNull(e.pay_note),
    headcount: blankToNull(e.headcount),
    start_timing: blankToNull(e.start_timing),
    work_days: blankToNull(e.work_days),
    benefit_note: blankToNull(e.benefit_note),
    contact_email: blankToNull(e.contact_email),
    contact_tel: blankToNull(e.contact_tel),
    contact_link: blankToNull(e.contact_link),
    contact_post: blankToNull(e.contact_post),
    requirements: cleanList(e.requirements),
    preferred: cleanList(e.preferred),
    required_docs: cleanList(e.required_docs),
    optional_docs: cleanList(e.optional_docs),
    process_steps: cleanList(e.process_steps),
  };
}

/**
 * 저장 전 검사 — 통과하지 못하면 사람이 읽을 문장을 돌려준다(`null`이면 이상 없음).
 *
 * DB CHECK와 겹치는 것은 제약 이름(`jobs_kind_matches_seat`)만으론 무엇을 어떻게 고쳐야 하는지
 * 알 수 없어서 먼저 잡는다. **겹치지 않는 것도 있다** — 아래 ⚠️ 표시한 셋은 DB가 막지 않으므로
 * 여기서 막지 않으면 **잘못된 값이 그대로 공개된다.**
 */
export function jobEditsError(e: JobEdits): string | null {
  // ⚠️ DB에 없는 검사 — NOT NULL은 빈 문자열을 막지 않는다
  if (!e.church_name) return "교회명은 비울 수 없습니다 — 공개 화면의 교회 이름이 빕니다.";
  if (!e.title) return "제목은 비울 수 없습니다.";
  if (!e.description) return "설명은 비울 수 없습니다 — 공개 상세가 빈 채로 나갑니다.";

  // CHECK `jobs_kind_matches_seat` — 종류가 최소 하나 있어야 하고, 짝이 양방향(⟺)이다
  if (e.job_kind.length === 0) return "종류(사역직·일반직)를 하나 이상 골라 주세요.";
  if (e.job_kind.includes("MINISTRY") !== e.position.length > 0) {
    return "사역직과 직분은 짝입니다 — 사역직을 고르면 직분도 고르고, 직분을 지우면 사역직도 빼 주세요.";
  }
  if (e.job_kind.includes("GENERAL") !== (e.role !== null)) {
    return "일반직과 직무명은 짝입니다 — 일반직을 고르면 직무명을 적고, 직무명을 지우면 일반직도 빼 주세요.";
  }

  // CHECK `jobs_needs_contact` — 검수와 달리 **DB가 막는다**. 먼저 잡아 사람이 읽을 말로 알린다
  if (!e.contact_email && !e.contact_tel && !e.contact_link && !e.contact_post) {
    return "지원 연락처는 넷 중 하나 이상 있어야 합니다 — 전부 비우면 저장되지 않습니다.";
  }

  // ⚠️ DB에 없는 검사 — `jobs`에는 `pay_range` CHECK가 없다(`review_data`엔 있다)
  if ((e.pay_min ?? 0) < 0 || (e.pay_max ?? 0) < 0) return "금액은 0 이상이어야 합니다.";
  if (e.pay_min !== null && e.pay_max !== null && e.pay_min > e.pay_max) {
    return "금액 최소가 최대보다 큽니다.";
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
 * 초안과 **저장된 행이 다른 칸만**. UPDATE를 여기에만 걸어 이미 같은 값인 컬럼은 건드리지 않는다.
 *
 * ⚠️ 비교 대상은 저장 직전에 다시 읽은 행이다(actions.ts) — 화면을 열어 둔 사이 크롤러가 바꾼 칸은
 *    "다른 칸"으로 잡혀 운영자가 본 값으로 되돌아간다. `jobs`에서 크롤러가 쓰는 칸은 `posted_at`
 *    하나이고 그건 편집 대상이 아니라, 실제로 되돌아갈 칸이 없다(검수와 다른 점).
 */
export function changedJobEdits(edits: JobEdits, original: JobEdits): Partial<JobEdits> {
  // Object.fromEntries는 타입을 잃는다 — 값의 출처가 같은 타입의 `edits`라 되돌려 붙여도 안전하다
  return Object.fromEntries(
    Object.entries(edits).filter(([key, value]) => !same(value, original[key as keyof JobEdits])),
  ) as Partial<JobEdits>;
}
