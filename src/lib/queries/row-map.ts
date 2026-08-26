import {
  CHURCH_CHANNELS,
  CHURCH_STATUSES,
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  FEATURED_TIERS,
  JOB_KINDS,
  JOB_SOURCES,
  JOB_STATUSES,
  PAY_PERIODS,
  POSITIONS,
  QUALIFICATIONS,
  REGIONS,
} from "@/constants/domain";
import { keyOf, keysOf } from "@/lib/domain-enum";
import type { Tables } from "@/types/database";
import type { Church, Job } from "@/types/domain";

// DB 행 → 도메인 타입. **`lib/queries/*` 내부 전용**(페이지·컴포넌트가 import하지 않는다).
//
// 왜 따로 두는가: 교회 매핑을 `jobs`·`churches`·`users` 세 seam이 함께 쓰고, 공고 매핑은 카드·상세·
// 운영자 행 셋이 같은 41컬럼을 읽는다. 파일마다 두면 컬럼 하나 늘 때 고칠 자리가 여섯 곳이 된다.
//
// ⚠️ **enum 컬럼은 `text + CHECK`라 생성 타입이 `string`이다**(types/database.ts). 그래서 여기서
//    `keyOf`/`keysOf`로 좁힌다 — 맵에 없는 값은 `null`(또는 버림)이 되어 화면이 조용히 깨지지 않는다.
// ⚠️ `position`은 DB가 `text[] NULL`이지만 도메인은 **non-null**이다(types/domain.ts Job.position).
//    `null → []` 정규화가 여기 한 곳에서만 일어나야 호출부가 두 상태를 검사하지 않는다.

/**
 * 카드·목록이 읽는 컬럼. 상세와 나눠 둔 이유는 **배열 다섯 개와 본문을 안 가져오기 위해서**다 —
 * 공개 목록은 모든 공고를 한 번에 내리는 설계라(`getAllJobCards`) 3천 건에서 그 차이가 payload가 된다.
 * 배열을 리스트에 넣지 않는다는 규칙이 아니라, **카드가 안 쓰는 값을 옮기지 않는다**는 것이다.
 */
const CARD_FIELDS = [
  "id",
  "church_id",
  "church_name",
  "denomination",
  "region",
  "city",
  "address",
  "title",
  "position",
  "role",
  "department",
  "employment_type",
  "qualification",
  "housing_provided",
  "pay_min",
  "pay_max",
  "pay_note",
  "pay_period",
  "status",
  "source",
  "featured_tier",
  "featured_until",
  "posted_at",
  "deadline",
] as const;

export const JOB_CARD_COLUMNS = CARD_FIELDS.join(", ");
export type JobCardRow = Pick<Tables<"jobs">, (typeof CARD_FIELDS)[number]>;

/** 상세·수정용 — 전 컬럼. 41개 도메인 필드가 전부 쓰이므로 나열하지 않는다 */
export const JOB_FULL_COLUMNS = "*";

/**
 * 공고에 딸린 교회 — **`id`와 검수 상태만** 가져온다.
 * 이름·교단·지역은 `jobs`의 비정규화 컬럼에서 온다(`jobChurchRef`의 규칙: "표시값은 전부 jobs에서").
 * 검수 상태는 공개 여부 판정에 필요하다 — `service.ts`는 RLS를 우회하므로 쿼리가 직접 걸어야 한다.
 */
export const CHURCH_REF_EMBED = "churches(id, verification_status)";
export type ChurchRefRow = Pick<Tables<"churches">, "id" | "verification_status">;

/** 교회 상세용 — 프로필 전체 + 채널·사진(1:N) */
export const CHURCH_FULL_COLUMNS = "*, church_links(type, url), church_photos(url, sort_order)";

export interface ChurchFullRow extends Tables<"churches"> {
  church_links: Pick<Tables<"church_links">, "type" | "url">[];
  church_photos: Pick<Tables<"church_photos">, "url" | "sort_order">[];
}

/** 카드가 읽는 만큼의 공고 — `Job`의 부분집합이라 카드·목록 계산에 그대로 쓴다 */
export type JobCardFields = Pick<
  Job,
  | "id"
  | "churchId"
  | "churchName"
  | "denomination"
  | "region"
  | "city"
  | "address"
  | "title"
  | "position"
  | "role"
  | "department"
  | "employmentType"
  | "qualification"
  | "housingProvided"
  | "payMin"
  | "payMax"
  | "payNote"
  | "payPeriod"
  | "status"
  | "source"
  | "featuredTier"
  | "featuredUntil"
  | "postedAt"
  | "deadline"
>;

export function toJobCardFields(row: JobCardRow): JobCardFields {
  return {
    id: row.id,
    churchId: row.church_id,
    churchName: row.church_name,
    denomination: keyOf(DENOMINATIONS, row.denomination),
    region: keyOf(REGIONS, row.region),
    city: row.city,
    address: row.address,
    title: row.title,
    position: keysOf(POSITIONS, row.position ?? []),
    role: row.role,
    department: keyOf(DEPARTMENTS, row.department),
    employmentType: keyOf(EMPLOYMENT_TYPES, row.employment_type),
    qualification: keyOf(QUALIFICATIONS, row.qualification),
    housingProvided: row.housing_provided,
    payMin: row.pay_min,
    payMax: row.pay_max,
    payNote: row.pay_note,
    payPeriod: keyOf(PAY_PERIODS, row.pay_period) ?? "MONTH",
    status: keyOf(JOB_STATUSES, row.status) ?? "CLOSED",
    source: keyOf(JOB_SOURCES, row.source) ?? "OPERATOR",
    featuredTier: keyOf(FEATURED_TIERS, row.featured_tier) ?? "NONE",
    featuredUntil: row.featured_until,
    postedAt: row.posted_at,
    deadline: row.deadline,
  };
}

/**
 * 전 컬럼 → `Job`.
 * ⚠️ 좁히기 실패의 기본값은 **덜 보이는 쪽**으로 넘어뜨린다 — `status`는 `CLOSED`, `featuredTier`는
 *    `NONE`. 알 수 없는 값을 공개·유료 노출로 읽으면 사고가 되고, 반대는 눈에 띄어 고쳐진다.
 */
export function toJob(row: Tables<"jobs">): Job {
  return {
    ...toJobCardFields(row),
    jobKind: keysOf(JOB_KINDS, row.job_kind),
    headcount: row.headcount,
    startTiming: row.start_timing,
    housingNote: row.housing_note,
    benefitNote: row.benefit_note,
    workDays: row.work_days,
    requirements: row.requirements,
    preferred: row.preferred,
    requiredDocs: row.required_docs,
    optionalDocs: row.optional_docs,
    processSteps: row.process_steps,
    description: row.description,
    sourceUrl: row.source_url,
    contactEmail: row.contact_email,
    contactTel: row.contact_tel,
    contactLink: row.contact_link,
    contactPost: row.contact_post,
  };
}

/** 교회 상세 → `Church`. 사진은 `sort_order` 순(첫 장이 커버라 순서가 뜻을 가진다) */
export function toChurch(row: ChurchFullRow): Church {
  return {
    id: row.id,
    name: row.name,
    denomination: keyOf(DENOMINATIONS, row.denomination),
    region: keyOf(REGIONS, row.region),
    city: row.city,
    address: row.address,
    // 좁히기 실패의 기본값은 **덜 보이는 쪽**이다 — 모르는 값을 공개로 읽으면 미검증 교회가 노출된다
    verificationStatus: keyOf(CHURCH_STATUSES, row.verification_status) ?? "PENDING",
    contactEmail: row.contact_email,
    contactTel: row.contact_tel,
    foundedYear: row.founded_year,
    photos: [...row.church_photos].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.url),
    links: row.church_links.flatMap((link) => {
      const type = keyOf(CHURCH_CHANNELS, link.type);
      return type ? [{ type, url: link.url }] : [];
    }),
  };
}
