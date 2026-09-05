import { REGIONS, type EmploymentType } from "@/constants/domain";
import { churchMetaLine, denominationLabel, formatPayShort, jobRoleLine } from "@/lib/format";
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

/** `og:description` 길이 — 카톡·슬랙 미리보기 두 줄 안에 들어오는 길이 */
const SHARE_DESCRIPTION_MAX = 80;

export interface ShareCell {
  label: string;
  value: string;
  /** 값이 없어 "협의"·"상시"·"미상"으로 채운 칸 — 흐리게 그려 값 있는 공고가 눈에 띈다 */
  muted: boolean;
}

export interface ShareCard {
  /** 교회 · 교단 — 이미지 맨 위 작은 줄 */
  context: string;
  /** 자리 한 줄(직분·부서·고용) — 이미지의 큰 글자 */
  role: string;
  /** 지역 · 사례비 · 마감 — 라벨+값 칸 셋 */
  cells: ShareCell[];
}

// "전북 전주시" — 시·군까지만. 구·동은 카드가 못 담는다
function shareRegion(church: JobDetail["churchRef"]): string | null {
  if (!church.region) return null;
  return [REGIONS[church.region], church.city?.split(" ")[0]].filter(Boolean).join(" ");
}

/**
 * 공고 공유 카드(OG 이미지)의 재료 — 이미지는 **글이 아니라 구조**를 그린다(2026-09-06).
 * 카톡·슬랙은 이미지 아래에 제목·설명을 따로 붙이므로 이미지에 공고 제목을 넣으면 같은 말이 세 번 나온다
 * (그전 카드가 그랬다 — 제목 두 번, 교회·교단·지역 두 번, "사례비 협의 · 상시모집"은 모집중의 73%·89%가 같은 글자).
 * 그래서 이미지 = 자리 한 줄 + 지역·사례비·마감 칸, 제목 = 교회가 쓴 말(`og:title`), 설명 = 본문 맛보기(`shareDescription`).
 */
export function jobShareCard(detail: JobDetail): ShareCard {
  const { job, churchRef } = detail;
  const region = shareRegion(churchRef);
  const pay = formatPayShort(job);
  // deadline은 "YYYY-MM-DD"(date 컬럼 · 시간대 없음)라 자르기만 한다 — `formatKstDate`는 timestamptz용
  const deadline = job.deadline
    ? `${Number(job.deadline.slice(5, 7))}/${Number(job.deadline.slice(8, 10))}`
    : null;
  // 직분이 "기타"뿐이고 직무도 없으면 자리 줄이 빈다 — 그때는 공고 종류로 말한다
  const role =
    jobRoleLine(job, { full: true }) || (job.jobKind.includes("GENERAL") ? "일반직" : "사역자");
  return {
    context: [churchRef.name, denominationLabel(churchRef.denomination)]
      .filter(Boolean)
      .join(" · "),
    role,
    cells: [
      { label: "지역", value: region ?? "미상", muted: region === null },
      { label: "사례비", value: pay, muted: pay === "협의" },
      { label: "마감", value: deadline ?? "상시", muted: deadline === null },
    ],
  };
}

/**
 * `og:description` — **교회가 쓴 본문의 첫 80자**. 이미지(구조)·제목(교회의 말)과 겹치지 않는 세 번째 정보다.
 * 본문이 빈 공고(DB는 NOT NULL이지만 빈 문자열이 가능)만 자리 요약으로 폴백한다.
 */
export function shareDescription(detail: JobDetail): string {
  const text = (detail.job.description || jobRoleSummary(detail)).replace(/\s+/g, " ").trim();
  return text.length > SHARE_DESCRIPTION_MAX
    ? `${text.slice(0, SHARE_DESCRIPTION_MAX).trimEnd()}…`
    : text;
}

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
