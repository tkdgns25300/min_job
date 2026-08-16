import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  POSITIONS,
  REGIONS,
  type Denomination,
  type Position,
} from "@/constants/domain";
import type { JobCard, JobChurchRef } from "@/types/domain";

// 도메인 값 표시 포매터

// 월 사례비 표시: 범위/단일/비정형(내규 등)/없음 순
export function formatPay(min: number | null, max: number | null, note: string | null): string {
  if (min !== null && max !== null && min !== max) return `${min}~${max}만원`;
  if (min !== null) return `${min}만원`;
  if (note) return note;
  return "협의";
}

// 교회 위치: 지역(+시). 모르는 조각은 **생략**한다 — 방문자에게 "미상"은 정보가 아니라 잡음이고,
// 크롤 공고는 지역이 비어 있는 경우가 흔하다(DATA §3). 둘 다 없으면 "" → 호출부가 줄째로 걷어낸다.
export function churchLocation(church: Pick<JobChurchRef, "region" | "city">): string {
  return [church.region ? REGIONS[church.region] : null, church.city].filter(Boolean).join(" ");
}

// 직분 라벨 — 한 공고가 여러 직분을 담을 수 있다(DATA §3 판정 규칙).
// 목록·카드는 줄이 넘치므로 축약("부목사 외 2"), 상세는 full로 전부 보여준다.
// 빈 배열(일반직 공고)은 "" — 호출부의 filter(Boolean)가 걸러낸다.
export function positionLabel(positions: Position[], opts: { full?: boolean } = {}): string {
  const labels = positions.map((p) => POSITIONS[p]);
  if (labels.length <= 1 || opts.full) return labels.join(" · ");
  return `${labels[0]} 외 ${labels.length - 1}`;
}

// 직분 · 부서 · 고용형태 한 줄 (카드·로우 공통). 상세는 { full: true }로 직분 전부.
export function jobRoleLine(
  job: Pick<JobCard, "position" | "department" | "employmentType">,
  opts: { full?: boolean } = {},
): string {
  return [
    positionLabel(job.position, opts),
    job.department ? DEPARTMENTS[job.department] : null,
    EMPLOYMENT_TYPES[job.employmentType],
  ]
    .filter(Boolean)
    .join(" · ");
}

// 교단 라벨 — 미상이면 null이라 호출부의 `filter(Boolean)`·조건부 렌더가 조각째 걷어낸다.
// (공개 화면 규칙. "미상"을 쓰는 곳은 운영자 화면 한 곳뿐이라 거기서 인라인 처리한다)
export function denominationLabel(denomination: Denomination | null): string | null {
  return denomination ? DENOMINATIONS[denomination] : null;
}

// 교회 요약 한 줄: 교단 · 지역. 아는 조각만 잇는다 — 전부 모르면 ""(호출부가 걷어낸다)
export function churchMetaLine(
  church: Pick<JobChurchRef, "denomination" | "region" | "city">,
): string {
  return [denominationLabel(church.denomination), churchLocation(church)]
    .filter(Boolean)
    .join(" · ");
}
