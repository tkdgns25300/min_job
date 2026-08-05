import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  POSITIONS,
  REGIONS,
} from "@/constants/domain";
import type { Church, JobCard } from "@/types/domain";

// 도메인 값 표시 포매터

// 월 사례비 표시: 범위/단일/비정형(내규 등)/없음 순
export function formatPay(min: number | null, max: number | null, note: string | null): string {
  if (min !== null && max !== null && min !== max) return `${min}~${max}만원`;
  if (min !== null) return `${min}만원`;
  if (note) return note;
  return "협의";
}

// 교회 위치: 지역(+시)
export function churchLocation(church: Pick<Church, "region" | "city">): string {
  return `${REGIONS[church.region]}${church.city ? ` ${church.city}` : ""}`;
}

// 직분 · 부서 · 고용형태 한 줄 (카드·로우 공통)
export function jobRoleLine(
  job: Pick<JobCard, "position" | "department" | "employmentType">,
): string {
  return [
    POSITIONS[job.position],
    job.department ? DEPARTMENTS[job.department] : null,
    EMPLOYMENT_TYPES[job.employmentType],
  ]
    .filter(Boolean)
    .join(" · ");
}

// 교회 요약 한 줄: 교단 · 지역
export function churchMetaLine(church: Pick<Church, "denomination" | "region" | "city">): string {
  return `${DENOMINATIONS[church.denomination]} · ${churchLocation(church)}`;
}
