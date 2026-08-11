import { REGIONS, type EmploymentType } from "@/constants/domain";
import { churchMetaLine, jobRoleLine } from "@/lib/format";
import type { JobDetail } from "@/types/domain";

// 우리 고용형태 → schema.org employmentType enum 매핑
const SCHEMA_EMPLOYMENT: Record<EmploymentType, string> = {
  FULL_TIME: "FULL_TIME",
  SEMI_FULL_TIME: "PART_TIME",
  PART_TIME: "PART_TIME",
};

const KRW_PER_MAN = 10000; // 만원 → 원

// 공고 한 줄 요약 (메타 description 폴백) — 표시 포맷은 format.ts가 단일 소스.
// 직접 조립하지 말 것: 직분 표기가 바뀌면(배열·축약) 여기까지 따라와야 한다.
export function jobRoleSummary(detail: JobDetail): string {
  const { job, church } = detail;
  return `${church.name} · ${churchMetaLine(church)} · ${jobRoleLine(job)}`;
}

// schema.org JobPosting JSON-LD — 검색엔진 구조화 노출 (SEO 성장 엔진)
export function jobPostingJsonLd(detail: JobDetail) {
  const { job, church } = detail;

  const baseSalary =
    job.payMin !== null
      ? {
          "@type": "MonetaryAmount",
          currency: "KRW",
          value: {
            "@type": "QuantitativeValue",
            minValue: job.payMin * KRW_PER_MAN,
            maxValue: (job.payMax ?? job.payMin) * KRW_PER_MAN,
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
