import {
  type ApplyMethod,
  type Department,
  type EmploymentType,
  type HousingOption,
  type JobKind,
  type PayPeriod,
  type Position,
  type Qualification,
} from "@/constants/domain";
import type { Church } from "@/types/domain";
import type { TablesInsert } from "@/types/database";

// 교회가 직접 등록·수정하는 공고의 규칙(순수) — **폼과 Server Action이 같은 답을 쓴다.**
// 화면은 왕복을 아끼려고 미리 돌리고, 신뢰 경계는 액션이라 서버가 같은 검증을 다시 한다.
//
// ⚠️ **`job-edits.ts`·`review-edits.ts`와 합치지 않는다** — 셋은 대상이 다르다:
//    · `review-edits`  = 미검수 크롤 초안(`review_data`)을 운영자가 고친다
//    · `job-edits`     = **이미 공개된** 공고를 운영자가 고친다
//    · 이 파일         = 교회가 **새로 만든다**
//    필수 집합이 다르다. 새로 만들 때는 `jobs`의 NOT NULL·CHECK를 전부 만족시켜야 하지만,
//    고칠 때는 이미 만족된 행을 손대므로 빈 칸을 허용하는 자리가 있다.
//
// ⚠️ **DB 제약을 여기서 사람 말로 되풀이한다.** DB가 최종 방어선이지만 거기 걸리면 사용자에게는
//    "저장하지 못했어요"밖에 못 보여준다 — 어느 칸이 문제인지는 여기서만 말할 수 있다.

/** 항목 = 이름 + 필수 여부(제출 서류에만 쓴다 — 자격·우대는 `required`를 무시한다) */
export interface CheckItem {
  name: string;
  required: boolean;
}

/**
 * 폼이 들고 있는 값 — **입력 그대로**다(금액·마감일이 문자열인 이유). DB 모양으로 바꾸는 것은
 * `toInsert`·`toUpdate`가 한다: 변환을 화면에 두면 폼과 액션이 각자 다르게 바꾼다.
 */
export interface JobDraft {
  jobKind: JobKind[];
  title: string;
  /** 사역직 자리 — `jobKind`에 `MINISTRY`가 있을 때만 뜻이 있다 */
  position: Position[];
  /** 일반직 직무명(자유 텍스트) — `GENERAL`이 있을 때만 */
  role: string;
  department: Department | null;
  employmentType: EmploymentType | null;
  /**
   * 자격 수준 — **단수 enum**이다(`position`과 달리 배열이 아니다). 다섯 값에 담기지 않는
   * 조건은 `requirements`가 받는다(`/admin/jobs/[id]`가 같은 말을 한다).
   * ⚠️ 직분으로 대체되지 않는다 — 부목사 공고 135건이 신학생 74 / 목사안수 50으로 갈린다
   *    (실측 2026-08-27). "그 자리인데 안수까지 요구하는가"는 직분이 답하지 못하는 질문이다.
   */
  qualification: Qualification | null;
  headcount: string;
  startTiming: string;
  workDays: string;
  description: string;
  requirements: CheckItem[];
  preferred: CheckItem[];
  payMin: string;
  payMax: string;
  payNote: string;
  payPeriod: PayPeriod;
  housing: HousingOption | null;
  /**
   * 사택 비정형 설명 — 칩이 담지 못하는 원문("사택 전세 지원 5천만원"). 칩과 **함께** 쓴다
   * (`housingLabel`이 "제공 · 사택 전세 지원 5천만원"으로 붙여 그린다).
   * ⚠️ 이 칸이 없던 동안 폼은 저장된 원문을 무조건 "협의"로 되읽어 **덮어썼다** — 크롤 863건 중
   *    355건이 "협의"가 아닌 원문이고 그중 69건은 금액이 적혀 있다(실측 2026-08-27). 크롤 공고에
   *    닿는 경로(클레임)가 아직 없어 터지지 않았을 뿐이다.
   */
  housingNote: string;
  benefitNote: string;
  docs: CheckItem[];
  processSteps: string[];
  applyMethods: Partial<Record<ApplyMethod, string>>;
  deadline: string;
  alwaysOpen: boolean;
}

/**
 * 검증에 걸린 칸 — 화면이 이 키로 해당 칸에 오류를 붙이고, 스텝 점프에도 쓴다.
 * ⚠️ **`JobDraft`의 키와 같은 이름을 쓴다** — 폼이 "방금 고친 칸의 오류를 지우는" 일을
 *    `patch`의 키로 한다. 여러 칸이 한 규칙을 이루는 `pay`만 예외이고, 그건 폼의
 *    `FIELD_GROUP`이 이어 준다.
 */
export type DraftField =
  | "jobKind"
  | "title"
  | "position"
  | "role"
  | "employmentType"
  | "description"
  | "pay"
  | "housing"
  | "applyMethods"
  | "deadline";

export type DraftErrors = Partial<Record<DraftField, string>>;

/**
 * 칸 길이 상한 — DB엔 없다(text). 화면과 서버가 같은 값을 써야 해서 여기 둔다.
 *
 * ⚠️ **지키는 방법이 두 갈래다.** 필수 칸(`title`·`role`·`description`·`contact`)은 넘치면
 *    오류를 띄운다 — 어차피 채워야 하는 칸이라 말해 주는 편이 낫다. 나머지 자유 텍스트는
 *    입력칸의 `maxLength`가 막고 `common()`이 한 번 더 자른다: 선택 칸이라 오류로 막아
 *    세울 값이 아니고, 화면이 이미 못 넘게 하므로 자르는 일이 사용자 눈앞에서 일어난다.
 *    (한때 이 다섯은 **선언만 되고 아무도 안 봤다** — 크롤 실데이터가 이미 넘겼다:
 *     `headcount` 285자 · `work_days` 179자 · `pay_note` 174자 · `benefit_note` 216자.)
 */
export const MAX_LENGTHS = {
  title: 100,
  role: 40,
  headcount: 30,
  startTiming: 40,
  workDays: 60,
  description: 4000,
  payNote: 60,
  housingNote: 100,
  benefitNote: 500,
  item: 60,
  contact: 200,
} as const;

/**
 * 사례비 상한(만원). **`pay_min`·`pay_max`가 `int4`(21억)라서 필요한 값**이다 — 넘기면
 * Postgres가 22003으로 거부하는데, 그러면 화면엔 어느 칸이 문제인지 못 말하는
 * "저장하지 못했어요"만 뜬다. 10억(만원 단위 10만)은 연 기준 담임 사례비도 닿지 못하는
 * 높이라 정상 입력을 막지 않으면서 그 사고를 없앤다(실데이터 최대 4,000).
 */
export const MAX_PAY = 100_000;

const tooLong = (value: string, max: number) => value.trim().length > max;

/**
 * 새 공고의 검증 — **`jobs`의 NOT NULL·CHECK와 1:1로 맞춘다.**
 *
 * | DB | 여기 |
 * |---|---|
 * | `title NOT NULL` | 제목 |
 * | `job_kind NOT NULL` + `jobs_kind_matches_seat` | 종류 + 직분/직무명 짝 |
 * | `description NOT NULL` | 본문 |
 * | `jobs_needs_contact` | 접수 방법 ≥ 1 |
 *
 * ⚠️ **DB가 요구하지 않는데 여기서 필수인 칸이 둘 있다**("DB가 허용한다"와 "받아야 한다"는 다른
 *    질문이다). 둘 다 근거는 같다 — **교회는 답을 알고, 구직자에겐 결정적이다.**
 *    · `employment_type` — 크롤 원문 언급률 51%
 *    · `housing_provided` — 크롤 명시율 40%(전임 71% · 파트 6%). 사택은 **있으면 자랑하고 없으면
 *      침묵**하는 값이라 원문 877건 중 "미제공"이 7건뿐이다. 그 침묵을 그대로 물려받으면 구직자는
 *      매번 교회에 물어야 한다 — 원문이 안 하는 말을 받아내는 것이 "구조화"다.
 *      ⚠️ `NEGOTIABLE`이 탈출구라 **모르는 교회에게 거짓을 강요하지 않는다**(그래서 필수로 둘 수 있다).
 *      사례비를 필수로 하지 않는 것과 갈리는 지점이다 — 그쪽은 "내규"라 답 자체가 없을 수 있다.
 *
 * @param previousDeadline 수정이면 **저장돼 있던 마감일**. 등록이면 넘기지 않는다 —
 *   지난 마감일 금지는 등록 기준의 규칙이라, 그대로 수정에 적용하면 마감된 공고에서
 *   제목 오타 하나 고치는 것도 막힌다(`getEditableJob`은 `status`를 거르지 않는다).
 *   **바꾸지 않은 값은 통과시킨다.**
 */
export function draftErrors(draft: JobDraft, previousDeadline?: string | null): DraftErrors {
  const errors: DraftErrors = {};

  if (draft.jobKind.length === 0) errors.jobKind = "사역직인지 일반직인지 골라 주세요.";

  if (!draft.title.trim()) errors.title = "공고 제목을 적어 주세요.";
  else if (tooLong(draft.title, MAX_LENGTHS.title)) errors.title = "제목이 너무 길어요.";

  // `jobs_kind_matches_seat` — 종류와 자리가 **짝이어야** 한다(한쪽만 있으면 DB가 거부한다)
  const ministry = draft.jobKind.includes("MINISTRY");
  const general = draft.jobKind.includes("GENERAL");
  if (ministry && draft.position.length === 0) errors.position = "직분을 골라 주세요.";
  if (general && !draft.role.trim()) errors.role = "직무명을 적어 주세요.";
  else if (general && tooLong(draft.role, MAX_LENGTHS.role)) errors.role = "직무명이 너무 길어요.";

  if (!draft.employmentType) errors.employmentType = "고용형태를 골라 주세요.";

  if (!draft.housing)
    errors.housing = "사택 제공 여부를 골라 주세요. 정해지지 않았으면 '협의'예요.";

  if (!draft.description.trim()) errors.description = "공고 본문을 적어 주세요.";
  else if (tooLong(draft.description, MAX_LENGTHS.description))
    errors.description = "본문이 너무 길어요.";

  // 사례비는 네 칸이 한 규칙이라 오류도 하나다(폼의 `FIELD_GROUP`이 어느 칸을 고쳐도 지운다)
  const payMin = money(draft.payMin);
  const payMax = money(draft.payMax);
  if ((payMin !== null && payMin > MAX_PAY) || (payMax !== null && payMax > MAX_PAY))
    errors.pay = "사례비가 너무 커요. 만원 단위로 적어 주세요.";
  else if (payMin !== null && payMax !== null && payMin > payMax)
    errors.pay = "사례비 최소가 최대보다 커요.";

  const contacts = filledContacts(draft.applyMethods);
  if (Object.keys(contacts).length === 0)
    errors.applyMethods = "접수 방법을 하나 이상 고르고 접수처를 적어 주세요.";
  else if (Object.values(contacts).some((value) => tooLong(value, MAX_LENGTHS.contact)))
    errors.applyMethods = "접수처가 너무 길어요.";

  // 마감일은 선택이지만, 적었다면 과거일 수 없다 — 등록하는 순간 목록에서 사라진다.
  // 수정에서 **원래 값 그대로면** 통과시킨다(위 @param 참조).
  if (
    !draft.alwaysOpen &&
    draft.deadline &&
    draft.deadline !== previousDeadline &&
    draft.deadline < todayFallback()
  )
    errors.deadline = "마감일이 오늘보다 앞이에요.";

  return errors;
}

/**
 * ⚠️ 마감일 비교의 "오늘" — 액션이 `todayInSeoul()`을 넘겨 줄 수 없는 자리(폼도 부른다)라
 *    여기서 만든다. **`job-visibility`의 `todayInSeoul`과 같은 방식**이고, 이 함수는
 *    cached scope에서 불리지 않는다(폼은 client, 액션은 uncached).
 */
function todayFallback(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/** 값이 있는 접수처만 — 고르기만 하고 비워 두면 접수 방법이 아니다(`jobs_needs_contact`) */
function filledContacts(
  methods: Partial<Record<ApplyMethod, string>>,
): Partial<Record<ApplyMethod, string>> {
  return Object.fromEntries(
    Object.entries(methods)
      .map(([key, value]) => [key, value?.trim() ?? ""])
      .filter(([, value]) => value.length > 0),
  );
}

/**
 * 만원 단위 정수 — 숫자가 아니면 `null`(비정형 표현은 `pay_note`가 받는다).
 * ⚠️ 자릿수가 터진 값을 `null`로 돌리지 않는다 — 그러면 적은 값이 **조용히 사라진다**.
 *    상한을 넘겨 돌려주고 `draftErrors`가 말로 막는다(`MAX_PAY`).
 */
function money(value: string): number | null {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isSafeInteger(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/**
 * 빈 문자열은 `null`로 — `NOT NULL`이 막지 못하는 `''`를 화면에 그리면 빈 줄이 남는다.
 * `max`를 주면 넘는 만큼 자른다(`items()`와 같은 관용구) — 화면이 `maxLength`로 이미 막지만
 * 액션은 직접 호출될 수 있다(신뢰 경계는 서버).
 */
function blankToNull(value: string, max?: number): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return max === undefined ? trimmed : trimmed.slice(0, max);
}

/** 목록 칸 — 공백 항목을 걷어내고 상한을 넘는 것은 자른다 */
function items(list: string[]): string[] {
  return list
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name) => name.slice(0, MAX_LENGTHS.item));
}

/**
 * 사택 칩 + 설명 → 두 컬럼. `null`은 "정보 없음/협의"고 `false`는 **명시적 미제공**이다 —
 * 셋을 구분한다(DATA §3). 설명은 셋 중 무엇을 골랐든 함께 갈 수 있다("제공 · 전세 5천만원").
 *
 * ⚠️ **"협의"는 값이 아니라 칩의 표현이다.** `NEGOTIABLE`은 `provided=null`로만 표현되는데 그건
 *    "정보 없음"과 구별되지 않아, 설명이 비었을 때만 `"협의"`를 적어 둘을 가른다. 폼이 되읽을
 *    때는 그 한 단어를 설명칸에 넣지 않는다(`housingNoteOf`) — 넣으면 교회가 지운 적 없는 글자가
 *    입력칸에 나타난다.
 */
function housing(
  option: HousingOption | null,
  note: string,
): { provided: boolean | null; note: string | null } {
  const written = blankToNull(note, MAX_LENGTHS.housingNote);
  if (option === "PROVIDED") return { provided: true, note: written };
  if (option === "NONE") return { provided: false, note: written };
  if (option === "NEGOTIABLE") return { provided: null, note: written ?? "협의" };
  return { provided: null, note: written };
}

/** draft에서 오는 공통 칸 — 등록과 수정이 같은 값을 써야 하는 부분 */
function common(draft: JobDraft) {
  const contacts = filledContacts(draft.applyMethods);
  const { provided, note } = housing(draft.housing, draft.housingNote);
  const numeric = money(draft.payMin) !== null || money(draft.payMax) !== null;
  return {
    title: draft.title.trim(),
    job_kind: draft.jobKind,
    // `jobs_kind_matches_seat` — 고르지 않은 쪽은 **비워야** 한다(남으면 CHECK가 거부한다)
    position: draft.jobKind.includes("MINISTRY") ? draft.position : [],
    role: draft.jobKind.includes("GENERAL") ? blankToNull(draft.role) : null,
    department: draft.department,
    employment_type: draft.employmentType,
    qualification: draft.qualification,
    headcount: blankToNull(draft.headcount, MAX_LENGTHS.headcount),
    start_timing: blankToNull(draft.startTiming, MAX_LENGTHS.startTiming),
    work_days: blankToNull(draft.workDays, MAX_LENGTHS.workDays),
    housing_provided: provided,
    housing_note: note,
    pay_min: money(draft.payMin),
    pay_max: money(draft.payMax),
    // 숫자를 적었으면 비정형 표현은 버린다 — 화면이 둘 중 하나만 그린다(`formatPay`)
    pay_note: numeric ? null : blankToNull(draft.payNote, MAX_LENGTHS.payNote),
    pay_period: draft.payPeriod,
    benefit_note: blankToNull(draft.benefitNote, MAX_LENGTHS.benefitNote),
    requirements: items(draft.requirements.map((item) => item.name)),
    preferred: items(draft.preferred.map((item) => item.name)),
    required_docs: items(draft.docs.filter((doc) => doc.required).map((doc) => doc.name)),
    optional_docs: items(draft.docs.filter((doc) => !doc.required).map((doc) => doc.name)),
    process_steps: items(draft.processSteps),
    description: draft.description.trim(),
    contact_email: contacts.EMAIL ?? null,
    contact_tel: contacts.TEL ?? null,
    contact_link: contacts.LINK ?? null,
    contact_post: contacts.POST ?? null,
    // 상시모집은 마감일이 없다는 뜻이다(DATA §6-1) — 빈 문자열을 넣으면 date 파싱이 터진다
    deadline: draft.alwaysOpen ? null : blankToNull(draft.deadline),
  };
}

/**
 * 새 공고 INSERT 행.
 *
 * ⚠️ **교회 값은 인증된 교회에서 복사한다**(`church_name`·`denomination`·`region`·`city`·`address`) —
 *    폼이 보낸 값을 쓰지 않는다. 의도적 비정규화이고(DATA §1 예외 ①) 크롤 공고가 `church_id=NULL`
 *    이어도 목록·필터가 도는 이유다.
 * ⚠️ **`source_url`을 넣지 않는다** — `jobs_collected_needs_source_url`이 `source='CHURCH'`를
 *    면제한다. 교회가 직접 쓴 공고는 원문 링크라는 것이 없다.
 * ⚠️ `status`·`featured_tier`는 DB 기본값(`OPEN`·`NONE`)에 맡긴다 — 등록이 곧 게재다(검수 없음 ·
 *    가드레일 #1 개정 2026-08-21).
 */
export function toInsert(draft: JobDraft, church: Church, today: string): TablesInsert<"jobs"> {
  return {
    ...common(draft),
    church_id: church.id,
    church_name: church.name,
    denomination: church.denomination,
    region: church.region,
    city: church.city,
    address: church.address,
    source: "CHURCH",
    posted_at: today,
  };
}

/**
 * 수정 UPDATE 패치 — **교회 값·`posted_at`·`source`는 건드리지 않는다.**
 * 게시일을 다시 찍으면 목록 최신순에서 새 공고처럼 올라간다(수정으로 순위를 살 수 있게 된다).
 */
export function toUpdate(draft: JobDraft): ReturnType<typeof common> {
  return common(draft);
}
