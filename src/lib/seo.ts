import { REGIONS, type EmploymentType } from "@/constants/domain";
import { churchMetaLine, formatPayShort, jobRoleLine, publicPositionLabel } from "@/lib/format";
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
// 교단·지역이 비면 그 조각만 빠진다(미claim 공고) — 교회명은 항상 있다.
export function jobRoleSummary(detail: JobDetail): string {
  const { churchRef } = detail;
  return [churchRef.name, churchMetaLine(churchRef), jobRoleLine(detail.job)]
    .filter(Boolean)
    .join(" · ");
}

/** 출근 문구가 이보다 길면 공유 카드에 넣지 않는다 — "예배 전(9시 30분부터), 예배 후…"는 썸네일이 못 담는다 */
const SHARE_WORK_DAYS_MAX = 12;

/**
 * 공유 카드(OG) 세 줄 — 이미지(`jobs/[id]/opengraph-image`)와 `og:description`이 **같은 줄**을 쓴다.
 *
 *   맥락   새소망교회 · 예장합동 · 경기 성남
 *   제목   유초등부 전임전도사              ← 자리 한 줄. 비면(직분 "기타"뿐) 교회가 쓴 제목으로
 *   사실   월 220만원 · 주일·수요 출근 · 마감 7/20   ← 사례비는 카드 규칙(금액 아니면 "협의")
 *
 * 교회가 쓴 제목은 `og:title`이 그대로 맡는다(알아보는 이름이라 고치지 않는다). 여기는 그 제목이 말하지
 * 않는 **비교 가능한 사실**만 — 공유받은 사람이 열지 않고도 조건을 읽게(운영자 요청 2026-09-05).
 */
export function jobShareLines(detail: JobDetail): {
  context: string;
  headline: string;
  facts: string;
} {
  const { job, churchRef } = detail;
  const workDays =
    job.workDays && job.workDays.length <= SHARE_WORK_DAYS_MAX ? `${job.workDays} 출근` : null;
  // deadline은 "YYYY-MM-DD"(date 컬럼 · 시간대 없음)라 자르기만 한다 — `formatKstDate`는 timestamptz용
  const deadline = job.deadline
    ? `마감 ${Number(job.deadline.slice(5, 7))}/${Number(job.deadline.slice(8, 10))}`
    : "상시모집";
  const pay = formatPayShort(job);
  // 자리 이름(직분·직무)이 있을 때만 자리 한 줄을 제목으로 — 직분이 "기타"뿐이면 자리 줄이 "찬양·예배"처럼
  // 부서만 남아 무엇을 뽑는지 안 보인다. 그때는 교회가 쓴 제목("오르간 반주자 모십니다")이 더 정확하다
  const hasRole = publicPositionLabel(job.position, { full: true }) !== "" || job.role !== null;
  return {
    context: [churchRef.name, churchMetaLine(churchRef)].filter(Boolean).join(" · "),
    headline: hasRole ? jobRoleLine(job, { full: true }) : job.title,
    facts: [pay === "협의" ? "사례비 협의" : pay, workDays, deadline].filter(Boolean).join(" · "),
  };
}

// schema.org JobPosting JSON-LD — 검색엔진 구조화 노출 (SEO 성장 엔진)
export function jobPostingJsonLd(detail: JobDetail) {
  const { job, churchRef: church } = detail;

  const baseSalary =
    job.payMin !== null
      ? {
          "@type": "MonetaryAmount",
          currency: "KRW",
          value: {
            "@type": "QuantitativeValue",
            minValue: job.payMin * KRW_PER_MAN,
            maxValue: (job.payMax ?? job.payMin) * KRW_PER_MAN,
            // 공고에 적힌 기간 그대로 — 우리 키(MONTH/YEAR)가 schema.org 값과 같다.
            // 하드코딩하면 연 금액을 월급으로 신고해 구글에 12배로 노출된다.
            unitText: job.payPeriod,
          },
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    // `||` — DB가 NOT NULL이라 null은 안 오지만 **빈 문자열**은 온다. `??`는 그걸 통과시켜 빈 설명이 나간다
    description: job.description || jobRoleSummary(detail),
    datePosted: job.postedAt,
    validThrough: job.deadline ?? undefined,
    // 미상이면 필드를 뺀다 — 구글에 빈 값·추측값을 넣지 않는다(원문 언급률 51%)
    ...(job.employmentType ? { employmentType: SCHEMA_EMPLOYMENT[job.employmentType] } : {}),
    hiringOrganization: {
      "@type": "Organization",
      name: church.name, // jobs.church_name — 미claim 공고도 항상 채용 주체를 밝힌다
      sameAs: detail.church?.links.find((l) => l.type === "HOMEPAGE")?.url ?? undefined,
    },
    // jobLocation은 JobPosting 필수 — 아는 만큼만 채운다(지역 미상이면 국가만 남는다).
    // 없는 지역을 임의로 넣으면 구글이 잘못된 위치로 색인해 지역 검색에서 엉뚱하게 잡힌다.
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: church.address ?? undefined,
        addressRegion: church.region ? REGIONS[church.region] : undefined,
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
 * Organization JSON-LD — 사이트 운영 주체(민잡). `(public)/layout.tsx`에서 공개 페이지 공통 출력
 * (root가 아니다 — 인증·운영자 영역은 noindex라 낼 이유가 없다).
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
