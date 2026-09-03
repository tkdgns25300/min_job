import { DENOMINATIONS, DEPARTMENTS, POSITIONS, REGIONS } from "@/constants/domain";
import type { JobCard } from "@/types/domain";

// 지역·직분·부서 **랜딩 라우트**의 규칙 — 어떤 값이 페이지를 갖는지, 주소가 어떻게 생기는지,
// 그 페이지에 어떤 공고가 들어가는지. 순수 함수만 있고 DB·요청·화면을 모른다.
//
// **왜 전용 라우트인가**: 노리는 검색어는 "경기 전도사 청빙"인데 `/jobs?region=GYEONGGI`는 색인 후보가
// 될 수 없다 — 필터가 100% 클라이언트라 쿼리가 달라도 서버 HTML이 같고, canonical도 `/jobs`를 가리켜
// "이 URL은 색인하지 말라"고 우리가 선언해 둔 상태다(`jobs/page.tsx` 주석). 그 쿼리 흡수는 그대로 두고,
// 검색이 찾아올 페이지를 **따로** 만든다.
//
// **단일축만 만든다(확정 2026-09-03)**. 지역×직분 79조합 중 24개가 공고 5건 미만이고, 부서까지 넣으면
// 231조합 중 166개가 5건 미만이다(실측). 필터 라벨만 다른 얇은 페이지를 대량 생성하면 키워드가 늘기는커녕
// 사이트 전체 평가가 내려가고("대량 생성 페이지"), 같은 검색어를 두 페이지가 나눠 가져 둘 다 약해진다.
// 조합은 서치 콘솔에 **수요**가 관측된 뒤에 만든다 — 건수는 우리 공급이고 페이지가 필요한 근거는 수요다.

export type FacetAxis = "region" | "position" | "department";

/**
 * 랜딩을 만들지 **않는** 값 — "기타"는 필터용 값이지 검색어가 아니다(아무도 "기타 직분 청빙"이라고
 * 검색하지 않는다). 검색어 자동완성이 이미 `ETC`를 같은 이유로 빼고 있다(`getSearchSuggestions`).
 * 부서 `ADMIN`은 7건뿐이라 지금은 뺀다 — 쌓이면 이 목록에서 지우기만 하면 된다.
 */
const EXCLUDED: Record<FacetAxis, readonly string[]> = {
  region: [],
  position: ["ETC"],
  department: ["ADMIN", "ETC"],
};

/**
 * 축마다 다른 것 — 라벨 맵과 제목에 붙는 명사. 값 목록·주소·판정은 아래 함수들이 이 맵에서 파생한다.
 * ⚠️ `as const`를 쓰지 않는다 — 라벨을 리터럴로 굳히면 `labels[key]`를 문자열로 색인할 수 없다.
 */
const AXIS: Record<FacetAxis, { labels: Record<string, string>; noun: string | null }> = {
  region: { labels: REGIONS, noun: "사역자" },
  position: { labels: POSITIONS, noun: null },
  department: { labels: DEPARTMENTS, noun: "사역자" },
};

export const FACET_AXES = Object.keys(AXIS) as FacetAxis[];

/**
 * 색인을 요청하는 최소 건수. 공고 3건짜리 페이지가 색인되면 도움이 아니라 해가 된다(위 "얇은 페이지").
 * 이 아래는 `noindex` + sitemap 제외 — 페이지 자체는 살려 둔다(사용자와 내부 링크는 그대로 쓴다).
 */
export const FACET_INDEX_MIN = 10;

/**
 * 페이지에 실제로 그리는 공고 수. 경기 221건을 다 뿌리면 HTML만 무겁고 아래는 아무도 보지 않는다 —
 * 상위 몇 건을 보여주고 나머지는 `/jobs`(필터 시드)로 넘긴다. 랜딩의 일은 목록이 아니라 착지다.
 */
export const FACET_JOBS_SHOWN = 20;

/** 분포 블록에 넣는 항목 수 상한 — 페이지를 채우는 게 목적이라 꼬리까지 나열하지 않는다 */
const TOP_N = 6;

/** 키 → URL 조각. `ASSOCIATE_PASTOR` → `associate-pastor` (한글·대문자는 주소에 쓰지 않는다) */
export function facetSlug(key: string): string {
  return key.toLowerCase().replaceAll("_", "-");
}

/** 그 축에서 랜딩을 갖는 값 — 라벨 맵 순서를 그대로 쓴다(도메인 정의가 정본) */
export function facetKeys(axis: FacetAxis): string[] {
  return Object.keys(AXIS[axis].labels).filter((key) => !EXCLUDED[axis].includes(key));
}

/**
 * URL 조각 → 키. 제외된 값·오타는 `null`이고 호출부가 404를 낸다 —
 * 없는 페이지가 200으로 열리면 검색엔진에 빈 페이지를 먹인다.
 */
export function facetKeyFromSlug(axis: FacetAxis, slug: string): string | null {
  return facetKeys(axis).find((key) => facetSlug(key) === slug) ?? null;
}

export function facetPath(axis: FacetAxis, key: string): string {
  return `/jobs/${axis}/${facetSlug(key)}`;
}

export function facetLabel(axis: FacetAxis, key: string): string {
  return AXIS[axis].labels[key] ?? key;
}

/** H1·title에 쓰는 이름. 직분은 그 자체가 사람이라 "사역자"를 붙이지 않는다("전도사 청빙 공고") */
export function facetHeading(axis: FacetAxis, key: string): string {
  const noun = AXIS[axis].noun;
  return [facetLabel(axis, key), noun, "청빙 공고"].filter(Boolean).join(" ");
}

const AXIS_TITLE_TAIL: Record<FacetAxis, string> = {
  region: "부목사·전도사 모집",
  position: "지역·교단·사례비 비교",
  department: "지역·교단·사례비 비교",
};

/** `<title>` — 축마다 다른 꼬리말을 붙인다(자기 축을 "비교" 항목으로 다시 말하지 않게) */
export function facetTitle(axis: FacetAxis, key: string): string {
  return `${facetHeading(axis, key)} — ${AXIS_TITLE_TAIL[axis]} | 민잡`;
}

const AXIS_DESC_TAIL: Record<FacetAxis, string> = {
  region: "직분·부서·교단·사례비",
  position: "지역·부서·교단·사례비",
  department: "지역·직분·교단·사례비",
};

/** meta description — 건수를 넣어 페이지마다 다른 문장이 되게 한다(같은 문구가 28개면 중복이다) */
export function facetDescription(axis: FacetAxis, key: string, total: number): string {
  const label = facetLabel(axis, key);
  const subject =
    axis === "region"
      ? `${label} 지역 교회의 사역자 청빙 공고`
      : axis === "position"
        ? `${label} 청빙 공고`
        : `${label} 담당 사역자 청빙 공고`;
  return `${subject} ${total}건을 한곳에서. ${AXIS_DESC_TAIL[axis]}로 비교하고 원문 공고 링크로 바로 지원하세요.`;
}

/**
 * 이 랜딩에 들어가는 공고인가 — **사역직만**이다.
 *
 * ⚠️ 판정은 `jobKind`가 아니라 **직분이 있는지**로 한다. `JobCard`에 `jobKind`가 없고(카드가 쓰지 않는다),
 *    실데이터에서 둘이 정확히 갈린다: 일반직 공고는 `position`이 비고 `role`(직무명)만 있고, 사역직과
 *    혼합 공고는 `position`을 갖는다(실측 2026-09-03 · 872 / 39 / 8). 혼합이 포함되는 것도 맞다 —
 *    SPEC이 "혼합 공고는 양쪽에 다 뜬다"로 확정했다.
 *    이 랜딩의 H1이 "…사역자 청빙 공고"라 일반직이 섞이면 제목과 내용이 어긋난다.
 */
function isMinistryCard(job: { position: readonly string[] }): boolean {
  return job.position.length > 0;
}

/** 그 축의 값에 해당하는 공고. 직분은 **배열이라 포함 판정**이다(한 공고가 여러 직분을 뽑는다) */
export function filterByFacet(jobs: readonly JobCard[], axis: FacetAxis, key: string): JobCard[] {
  const matches = (job: JobCard) => {
    if (axis === "region") return job.church.region === key;
    if (axis === "department") return job.department === key;
    return job.position.some((position) => position === key);
  };
  return jobs.filter((job) => isMinistryCard(job) && matches(job));
}

/** 분포 한 줄 — `href`가 있으면 다른 랜딩으로 가는 내부 링크가 된다(교단은 랜딩이 없어 null) */
export interface FacetItem {
  label: string;
  count: number;
  href: string | null;
}

export interface FacetGroup {
  label: string;
  items: FacetItem[];
}

/**
 * 랜딩 페이지를 채우는 분포 — 공고 목록만 있으면 필터 라벨만 다른 얇은 페이지와 구별되지 않는다.
 * 우리는 구조화된 데이터를 갖고 있어 이걸 공짜로 만들 수 있고, 경쟁 사이트가 못 하는 부분이다.
 *
 * **자기 축은 뺀다** — 경기 페이지에서 "지역: 경기 221건"은 정보가 아니다.
 * 링크가 걸린 항목은 그대로 내부 링크 그물이 된다(크롤러의 발견 경로 · SEO 절).
 */
export function facetGroups(jobs: readonly JobCard[], axis: FacetAxis): FacetGroup[] {
  const groups: FacetGroup[] = [];
  if (axis !== "region") {
    groups.push(distribution("지역", jobs, (job) => job.church.region, REGIONS, "region"));
  }
  groups.push(cityDistribution(jobs));
  if (axis !== "position") {
    groups.push(spreadDistribution("직분", jobs, (job) => job.position, POSITIONS, "position"));
  }
  if (axis !== "department") {
    groups.push(distribution("부서", jobs, (job) => job.department, DEPARTMENTS, "department"));
  }
  groups.push(distribution("교단", jobs, (job) => job.church.denomination, DENOMINATIONS, null));
  return groups.filter((group) => group.items.length > 0);
}

/** 값 하나를 갖는 칸(지역·부서·교단)의 분포 — 미상은 세지 않는다(모르는 것을 항목으로 만들지 않는다) */
function distribution(
  label: string,
  jobs: readonly JobCard[],
  pick: (job: JobCard) => string | null,
  labels: Record<string, string>,
  axis: FacetAxis | null,
): FacetGroup {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const key = pick(job);
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { label, items: toItems(counts, (key) => labels[key] ?? key, axis) };
}

/** 배열 칸(직분)의 분포 — 한 공고가 여러 칸에 센다 */
function spreadDistribution(
  label: string,
  jobs: readonly JobCard[],
  pick: (job: JobCard) => readonly string[],
  labels: Record<string, string>,
  axis: FacetAxis,
): FacetGroup {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    for (const key of pick(job)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { label, items: toItems(counts, (key) => labels[key] ?? key, axis) };
}

/** 시·군은 자유 텍스트라 라벨 맵도 랜딩도 없다 — 이름 그대로 세고 링크는 걸지 않는다 */
function cityDistribution(jobs: readonly JobCard[]): FacetGroup {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const city = job.church.city;
    if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  return { label: "주요 지역", items: toItems(counts, (city) => city, null) };
}

/** 많은 순 → 동수면 **키** 순(결과가 요청마다 흔들리지 않게). 랜딩이 없는 값은 링크를 걸지 않는다 */
function toItems(
  counts: Map<string, number>,
  label: (key: string) => string,
  axis: FacetAxis | null,
): FacetItem[] {
  const linkable = axis === null ? [] : facetKeys(axis);
  return [...counts]
    .sort(([aKey, aCount], [bKey, bCount]) => bCount - aCount || aKey.localeCompare(bKey))
    .slice(0, TOP_N)
    .map(([key, count]) => ({
      label: label(key),
      count,
      href: axis !== null && linkable.includes(key) ? facetPath(axis, key) : null,
    }));
}

/** 그 축의 다른 값들 — 페이지 하단의 형제 링크. 자기 자신은 뺀다 */
export function siblingFacets(axis: FacetAxis, key: string): { label: string; href: string }[] {
  return facetKeys(axis)
    .filter((other) => other !== key)
    .map((other) => ({ label: facetLabel(axis, other), href: facetPath(axis, other) }));
}

/**
 * 한글 라벨로 랜딩을 찾는다 — 홈의 손으로 고른 추천 검색어("전도사"·"서울")를 랜딩 링크로 승격하는 데 쓴다.
 * 랜딩이 없는 말(교단 "예장합동"·자유 검색어)은 `null`이고 호출부가 검색 쿼리로 폴백한다.
 */
export function facetPathForLabel(label: string): string | null {
  for (const axis of FACET_AXES) {
    const key = facetKeys(axis).find((candidate) => facetLabel(axis, candidate) === label);
    if (key !== undefined) return facetPath(axis, key);
  }
  return null;
}

/**
 * 공고 하나가 속한 랜딩들 — 상세 페이지의 "같은 조건 모아보기". 여기가 내부 링크의 주 공급원이다.
 *
 * ⚠️ **일반직 공고는 아무 링크도 주지 않는다.** 랜딩이 사역직만 담으므로(`isMinistryCard`), 링크를 주면
 *    "경기 사역자 청빙 공고"로 보내 놓고 그 목록에 정작 이 공고가 없다 — 사람에게는 헛걸음이고
 *    크롤러에게는 앵커 텍스트와 목적지가 어긋난 링크다. 판정은 필터와 **같은 술어**를 쓴다(사본 금지).
 */
export function facetsOfJob(job: {
  region: string | null;
  position: readonly string[];
  department: string | null;
}): { label: string; href: string }[] {
  if (!isMinistryCard(job)) return [];
  const links: { label: string; href: string }[] = [];
  const push = (axis: FacetAxis, key: string | null) => {
    if (key !== null && facetKeys(axis).includes(key)) {
      links.push({ label: facetHeading(axis, key), href: facetPath(axis, key) });
    }
  };
  push("region", job.region);
  for (const position of job.position) push("position", position);
  push("department", job.department);
  return links;
}

/** `/jobs`로 넘길 때 쓰는 필터 시드 — 기존 클라이언트 필터가 읽는 쿼리 모양이다(`jobs-url-state`) */
export function facetJobsHref(axis: FacetAxis, key: string): string {
  return `/jobs?${axis}=${key}`;
}
