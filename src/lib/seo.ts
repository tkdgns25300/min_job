import { REGIONS, type EmploymentType } from "@/constants/domain";
import { churchMetaLine, jobRoleLine } from "@/lib/format";
import { BUSINESS_INFO } from "@/constants/business";
import { SITE_OPEN_GRAPH, SITE_URL } from "@/constants/site";
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
    // 민잡이 부여한 공고 번호. 구글이 같은 공고를 사이트 간·시점 간 추적하는 데 쓴다(권장 필드).
    identifier: { "@type": "PropertyValue", name: SITE_OPEN_GRAPH.siteName, value: job.id },
    directApply: false, // 사이트 내 지원 없음 — 교회 연락처로 직접 지원(SPEC 지원 모델)
  };
}

/**
 * Organization JSON-LD — 사이트 운영 주체(민잡). root layout에서 전 페이지 공통 출력.
 * 공고의 `hiringOrganization`(교회)과 다르다 — 이건 **서비스 자신**을 설명한다.
 * ⚠️ 로고는 정사각 파일이 생기면 `logo`를 추가한다(없어도 유효).
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_OPEN_GRAPH.siteName,
    url: SITE_URL,
    email: BUSINESS_INFO.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS_INFO.address,
      addressCountry: "KR",
    },
  };
}

/** 빵부스러기 한 칸 — 마지막 칸은 현재 페이지라 `path`를 주지 않는다(구글 권장) */
interface Crumb {
  name: string;
  path?: string;
}

/**
 * BreadcrumbList JSON-LD — 검색 결과에서 URL 대신 경로를 보여준다.
 * 홈은 항상 첫 칸이라 호출부가 넘기지 않는다.
 */
export function breadcrumbJsonLd(trail: Crumb[]) {
  const crumbs: Crumb[] = [{ name: "홈", path: "/" }, ...trail];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.path ? { item: `${SITE_URL}${c.path}` } : {}),
    })),
  };
}
