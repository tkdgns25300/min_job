import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  EXPOSURE_PRODUCTS,
  POSITIONS,
  QUALIFICATIONS,
  REGIONS,
  tiersForSlot,
  type PayPeriod,
} from "@/constants/domain";
import { normalizeChurchName } from "@/lib/job-church";
import type { FacetCounts, FilterDim, JobCard } from "@/types/domain";

// 클라이언트 필터/정렬 (순수 함수) — `/jobs`는 서버가 전체 카드를 한 번 내리고 여기서 다 거른다.
// **서버로 옮기지 않는다**(CLAUDE.md 아키텍처 표): 쿼리가 달라도 서버 HTML이 같아서 `/jobs`가 캐시되고
// canonical도 하나로 남는다. 규모가 문제가 되면 그때 재검토한다(ROADMAP `/jobs` payload 항목).

const MONTHS_PER_YEAR = 12;

export interface JobFilterCriteria {
  q: string;
  selected: Record<FilterDim, Set<string>>;
  payMin: number | null;
  payMax: number | null;
  includeNego: boolean;
  housingOnly: boolean;
}

/**
 * 사례비 필터의 비교값 — **월 기준으로 환산**한다. 필터 입력은 항상 월 금액이고
 * (`job-filter.tsx`의 "월 사례비"), 공고는 연 기준일 수 있어 그냥 비교하면
 * 연 4,140만원 공고가 "월 300만원 이상"에 걸린다(4140 ≥ 300).
 *
 * ⚠️ 환산값은 **판정에만** 쓴다 — 화면에는 원문 단위를 그대로 보여준다(`formatPay`).
 *    연봉에 상여가 섞이면 ÷12가 실제 월 지급액이 아니라서, 표시에 쓰면 없는 숫자를 만든다.
 */
function monthlyPay(amount: number, period: PayPeriod): number {
  return period === "YEAR" ? amount / MONTHS_PER_YEAR : amount;
}

/**
 * 축(`FilterDim`)마다 **그 공고가 가진 값** — 미상(null)이면 빈 배열이다.
 * 필터 판정과 칩 건수가 이 한 곳을 같이 본다. 둘이 갈리면 "유초등부 58"을 눌러 다른 수가 나온다.
 *
 * ⚠️ 미상은 어느 칸에도 세지 않고, 그래서 그 축을 고른 순간 탈락한다 — 모르는 값을 아무 칸에나 넣으면
 *    필터가 거짓말이 된다(DATA §3). 부서를 고르면 부서 미상 공고가 통째로 빠지는데, 그 사실은
 *    칩에 붙는 건수가 대신 말해 준다(`facetCounts` · 2026-09-04).
 */
const DIM_VALUES: Record<FilterDim, (job: JobCard) => readonly string[]> = {
  denomination: (j) => (j.church.denomination ? [j.church.denomination] : []),
  region: (j) => (j.church.region ? [j.church.region] : []),
  // 직분만 배열이다 — 자리가 여럿이거나 자격을 열어 둔 공고는 그 직분들에 모두 센다(DATA §3)
  position: (j) => j.position,
  department: (j) => (j.department ? [j.department] : []),
  employmentType: (j) => (j.employmentType ? [j.employmentType] : []),
  qualification: (j) => (j.qualification ? [j.qualification] : []),
};

const DIMS = Object.keys(DIM_VALUES) as FilterDim[];

/** 한 축의 판정 — 안 고른 축은 통과, 고른 축은 값이 하나라도 겹치면 통과(축 안은 OR) */
function matchesDim(job: JobCard, dim: FilterDim, chosen: Set<string>): boolean {
  return chosen.size === 0 || DIM_VALUES[dim](job).some((value) => chosen.has(value));
}

/** 사례비 — 숫자가 없는 공고(협의)를 넣을지는 `includeNego`가 정한다 */
function matchesPay(job: JobCard, c: JobFilterCriteria): boolean {
  if (job.payMin === null && job.payMax === null) return c.includeNego;
  const max = monthlyPay(job.payMax ?? job.payMin ?? 0, job.payPeriod);
  const min = monthlyPay(job.payMin ?? job.payMax ?? 0, job.payPeriod);
  return (c.payMin === null || max >= c.payMin) && (c.payMax === null || min <= c.payMax);
}

// 검색어는 **공백으로 나눠 단어마다** 본다 — "방주교회 전임교역자"처럼 교회명과 제목 단어를 함께 적으면
// 통짜 substring으로는 아무것도 안 나온다(실측 2026-08-29: 0건). 단어가 전부 들어 있으면 매칭(AND).
function searchTerms(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean);
}

function matchesTerms(job: JobCard, terms: string[]): boolean {
  if (terms.length === 0) return true;
  // 자유검색 매칭 소스 = 교회명·제목·지역·도시 + 직분·직무·부서·교단·고용형태
  // (직무는 일반직의 직분 짝이라 빠지면 "행정간사"로 검색해도 그 공고가 안 나온다.
  //  단 검색어 **제안**에는 넣지 않는다 — 자유 텍스트라 표기가 제각각이어서 후보로 부적합하다)
  // (검색어 완성 후보와 소스를 맞춰, 제안한 검색어가 반드시 결과로 이어지게 한다)
  const hay = [
    job.church.name,
    // 정규화형도 넣는다 — 검색어 완성이 교회명 표기 흔들림("○○ 교회"/"예장합동 ○○교회")을
    // 하나로 묶어 대표 하나만 제안하므로, 원문 표기만 훑으면 **제안한 말로 검색했는데 안 나오는**
    // 공고가 생긴다(getSearchSuggestions와 짝을 이루는 계약).
    normalizeChurchName(job.church.name),
    job.title,
    job.church.region ? REGIONS[job.church.region] : "",
    job.church.city ?? "",
    ...job.position.map((p) => POSITIONS[p]),
    job.role ?? "",
    job.department ? DEPARTMENTS[job.department] : "",
    job.church.denomination ? DENOMINATIONS[job.church.denomination] : "",
    job.employmentType ? EMPLOYMENT_TYPES[job.employmentType] : "",
    job.qualification ? QUALIFICATIONS[job.qualification] : "",
  ].join(" ");
  return terms.every((term) => hay.includes(term));
}

/** 축이 아닌 조건 — 사택·사례비·검색어. 건수를 셀 때도 **항상** 적용한다(축만 하나 풀어서 센다) */
function matchesRest(job: JobCard, c: JobFilterCriteria, terms: string[]): boolean {
  if (c.housingOnly && job.housingProvided !== true) return false;
  return matchesPay(job, c) && matchesTerms(job, terms);
}

export function filterAndSortJobs(jobs: JobCard[], c: JobFilterCriteria): JobCard[] {
  const terms = searchTerms(c.q);
  const result = jobs.filter(
    (job) =>
      matchesRest(job, c, terms) && DIMS.every((dim) => matchesDim(job, dim, c.selected[dim])),
  );

  // 순수 최신순 — 사용자가 고르는 정렬축은 없다(SPEC 정렬·필터 규칙). 유료 노출은 정렬이 아니라
  // **자리**다(`splitListAds`) — 한때 등급이 정렬 1차 키였는데 정원 없이 정렬로 올리면 팔릴수록 목록이
  // 광고판이 되어 폐기했다(2026-09-02).
  result.sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  return result;
}

/**
 * "이 값을 고르면 몇 건" — 칩마다 붙는 수다. **자기 축의 선택만 무시하고** 나머지 조건(다른 축·검색어·
 * 사례비·사택)은 그대로 적용한다. 그래서 지역을 서울로 좁히면 부서 칩의 수가 함께 줄고, 0이 되는 칩은
 * 누르기 전에 보인다(아마존·에어비앤비식 facet count).
 *
 * 미상 공고는 어느 칩에도 세지 않아 **칩 수의 합이 "총 N건"보다 작다.** 그게 이 숫자가 하는 말이다 —
 * 부서 없는 공고 643건(실측 2026-09-04)은 부서를 고르는 순간 빠지고, 사용자는 누르기 전에 그걸 안다.
 *
 * 축을 하나씩 풀어 6번 훑지 않고 한 번만 훑는다 — 공고마다 **어긋난 축의 개수**를 세서, 0개면 모든 축의
 * 건수에, 1개면 그 축의 건수에만 넣는다(2개 이상 어긋나면 어느 한 축을 풀어도 걸리지 않는다).
 *
 * ⚠️ **이 수는 공고를 세고 "총 N건"은 광고 로우를 뺀 수다**(`splitListAds` · SPEC 수익화 절) — 광고가 서면
 *    칩이 라벨보다 최대 5 크다. 화면에 서는 줄 수와는 맞으므로 그대로 둔 값 차이다(근거는 SPEC 정렬·필터 절).
 * ⚠️ 값 배열에 **중복이 없어야** 한 공고를 두 번 세지 않는다 — `position`은 `row-map`이 seam에서 지운다.
 */
export function facetCounts(jobs: JobCard[], c: JobFilterCriteria): FacetCounts {
  const terms = searchTerms(c.q);
  const counts = Object.fromEntries(DIMS.map((dim) => [dim, {}])) as FacetCounts;

  for (const job of jobs) {
    if (!matchesRest(job, c, terms)) continue;
    const missed = DIMS.filter((dim) => !matchesDim(job, dim, c.selected[dim]));
    if (missed.length > 1) continue;

    for (const dim of missed.length === 0 ? DIMS : missed) {
      const tally = counts[dim];
      for (const value of DIM_VALUES[dim](job)) tally[value] = (tally[value] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * 1페이지 맨 위 광고 로우 — **필터를 통과한 결과 중** 목록 자리를 가진 등급을 사다리 순(스페셜 → 플러스)으로,
 * 등급마다 **정원까지만**(스페셜 3·플러스 2 = 최대 5줄). 정원이 상한인 이유: 스페셜이 여섯이면 플러스가
 * 자기가 산 자리를 못 받는다 — 한 등급이 다른 등급의 줄을 먹지 않게 등급별로 자른다.
 * 사용자가 건 필터에 걸리지 않는 광고는 서지 않는다(그 화면의 결과에 원래 들어갈 공고만 광고가 된다).
 * `rest`가 일반 목록이고 "총 N건"은 `rest`만 센다 — 광고는 결과 수에 들어가지 않는다(SPEC 수익화 절).
 * **결과가 없으면 자리도 없다** — 광고는 결과 위에 서는 자리라, 필터에 광고 공고만 남으면 그건 광고가 아니라
 * 결과다(라벨 없이 `rest`로 간다). 안 그러면 "총 0건" 아래에 로우가 서는 자기모순이 난다.
 * 입력은 `filterAndSortJobs`의 결과(최신순)라 같은 등급 안에서는 최신순이 유지된다.
 */
export function splitListAds(jobs: JobCard[]): { ads: JobCard[]; rest: JobCard[] } {
  const ads = tiersForSlot("list").flatMap((tier) => {
    const capacity = EXPOSURE_PRODUCTS[tier].capacity ?? jobs.length;
    return jobs.filter((job) => job.featuredTier === tier).slice(0, capacity);
  });
  const adIds = new Set(ads.map((job) => job.id));
  const rest = jobs.filter((job) => !adIds.has(job.id));
  return rest.length === 0 ? { ads: [], rest: jobs } : { ads, rest };
}
