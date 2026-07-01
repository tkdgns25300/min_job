import {
  DENOMINATIONS,
  REGIONS,
  POSITIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  type EmploymentType,
} from "@/constants/domain";
import type { JobDetail } from "@/types/domain";

// 우리 고용형태 → schema.org employmentType enum 매핑
const SCHEMA_EMPLOYMENT: Record<EmploymentType, string> = {
  FULL_TIME: "FULL_TIME",
  SEMI_FULL_TIME: "PART_TIME",
  PART_TIME: "PART_TIME",
};

const KRW_PER_MAN = 10000; // 만원 → 원

// 공고 한 줄 요약 (메타 description 폴백)
export function jobRoleSummary(detail: JobDetail): string {
  const { job, church } = detail;
  const role = [
    POSITIONS[job.position],
    job.department ? DEPARTMENTS[job.department] : null,
    EMPLOYMENT_TYPES[job.employmentType],
  ]
    .filter(Boolean)
    .join(" · ");
  const location = `${REGIONS[church.region]}${church.city ? ` ${church.city}` : ""}`;
  return `${church.name} · ${DENOMINATIONS[church.denomination]} · ${location} · ${role}`;
}

// schema.org JobPosting JSON-LD — 검색엔진 구조화 노출 (SEO 성장 엔진)
export function jobPostingJsonLd(detail: JobDetail) {
  const { job, church } = detail;

  const baseSalary =
    job.stipendMin !== null
      ? {
          "@type": "MonetaryAmount",
          currency: "KRW",
          value: {
            "@type": "QuantitativeValue",
            minValue: job.stipendMin * KRW_PER_MAN,
            maxValue: (job.stipendMax ?? job.stipendMin) * KRW_PER_MAN,
            unitText: "MONTH",
          },
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description ?? jobRoleSummary(detail),
    datePosted: job.postedAt,
    validThrough: job.deadline ?? undefined,
    employmentType: SCHEMA_EMPLOYMENT[job.employmentType],
    hiringOrganization: {
      "@type": "Organization",
      name: church.name,
      sameAs: church.links.find((l) => l.type === "HOMEPAGE")?.url ?? undefined,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressRegion: REGIONS[church.region],
        addressLocality: church.city ?? undefined,
        addressCountry: "KR",
      },
    },
    baseSalary,
    directApply: false,
  };
}
