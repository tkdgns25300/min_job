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
import type { FilterDim, JobCard } from "@/types/domain";

// 클라이언트 필터/정렬 (순수 함수) — `/jobs`는 서버가 전체 카드를 한 번 내리고 여기서 다 거른다.
// 실제 데이터 연동 시 이 로직은 lib/queries의 서버 쿼리로 이전한다.

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

export function filterAndSortJobs(jobs: JobCard[], c: JobFilterCriteria): JobCard[] {
  // 검색어는 **공백으로 나눠 단어마다** 본다 — "방주교회 전임교역자"처럼 교회명과 제목 단어를 함께 적으면
  // 통짜 substring으로는 아무것도 안 나온다(실측 2026-08-29: 0건). 단어가 전부 들어 있으면 매칭(AND).
  const terms = c.q.trim().split(/\s+/).filter(Boolean);
  const s = c.selected;

  const result = jobs.filter((j) => {
    // 미상(null)은 축을 고른 순간 탈락한다 — 모르는 값을 아무 칸에나 넣으면 필터가 거짓말이 된다.
    // (지역 미상 공고가 사실상 안 보이게 되는 건 알고 있는 대가 — 검수에서 먼저 채운다, DATA §3)
    if (s.denomination.size && !s.denomination.has(j.church.denomination ?? "")) return false;
    if (s.region.size && !s.region.has(j.church.region ?? "")) return false;
    if (s.position.size && !j.position.some((p) => s.position.has(p))) return false;
    if (s.department.size && (!j.department || !s.department.has(j.department))) return false;
    if (s.employmentType.size && (!j.employmentType || !s.employmentType.has(j.employmentType)))
      return false;
    if (s.qualification.size && (!j.qualification || !s.qualification.has(j.qualification)))
      return false;
    if (c.housingOnly && !j.housingProvided) return false;

    const hasNumber = j.payMin !== null || j.payMax !== null;
    if (!hasNumber) {
      if (!c.includeNego) return false;
    } else {
      const jMax = monthlyPay(j.payMax ?? j.payMin ?? 0, j.payPeriod);
      const jMin = monthlyPay(j.payMin ?? j.payMax ?? 0, j.payPeriod);
      if (c.payMin !== null && jMax < c.payMin) return false;
      if (c.payMax !== null && jMin > c.payMax) return false;
    }

    if (terms.length > 0) {
      // 자유검색 매칭 소스 = 교회명·제목·지역·도시 + 직분·직무·부서·교단·고용형태
      // (직무는 일반직의 직분 짝이라 빠지면 "행정간사"로 검색해도 그 공고가 안 나온다.
      //  단 검색어 **제안**에는 넣지 않는다 — 자유 텍스트라 표기가 제각각이어서 후보로 부적합하다)
      // (검색어 완성 후보와 소스를 맞춰, 제안한 검색어가 반드시 결과로 이어지게 한다)
      const hay = [
        j.church.name,
        // 정규화형도 넣는다 — 검색어 완성이 교회명 표기 흔들림("○○ 교회"/"예장합동 ○○교회")을
        // 하나로 묶어 대표 하나만 제안하므로, 원문 표기만 훑으면 **제안한 말로 검색했는데 안 나오는**
        // 공고가 생긴다(getSearchSuggestions와 짝을 이루는 계약).
        normalizeChurchName(j.church.name),
        j.title,
        j.church.region ? REGIONS[j.church.region] : "",
        j.church.city ?? "",
        ...j.position.map((p) => POSITIONS[p]),
        j.role ?? "",
        j.department ? DEPARTMENTS[j.department] : "",
        j.church.denomination ? DENOMINATIONS[j.church.denomination] : "",
        j.employmentType ? EMPLOYMENT_TYPES[j.employmentType] : "",
        j.qualification ? QUALIFICATIONS[j.qualification] : "",
      ].join(" ");
      if (!terms.every((term) => hay.includes(term))) return false;
    }
    return true;
  });

  // 순수 최신순 — 사용자가 고르는 정렬축은 없다(SPEC 정렬·필터 규칙). 유료 노출은 정렬이 아니라
  // **자리**다(`splitListAds`) — 한때 등급이 정렬 1차 키였는데 정원 없이 정렬로 올리면 팔릴수록 목록이
  // 광고판이 되어 폐기했다(2026-09-02).
  result.sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  return result;
}

/**
 * 1페이지 맨 위 광고 로우 — **필터를 통과한 결과 중** 목록 자리를 가진 등급을 사다리 순(스페셜 → 플러스)으로,
 * 등급마다 **주 정원까지만**(스페셜 3·플러스 2 = 최대 5줄). 정원이 상한인 이유: 스페셜이 여섯이면 플러스가
 * 자기가 산 자리를 못 받는다 — 한 등급이 다른 등급의 줄을 먹지 않게 등급별로 자른다.
 * 사용자가 건 필터에 걸리지 않는 광고는 서지 않는다(그 화면의 결과에 원래 들어갈 공고만 광고가 된다).
 * `rest`가 일반 목록이고 "총 N건"은 `rest`만 센다 — 광고는 결과 수에 들어가지 않는다(SPEC 수익화 절).
 * **결과가 없으면 자리도 없다** — 광고는 결과 위에 서는 자리라, 필터에 광고 공고만 남으면 그건 광고가 아니라
 * 결과다(라벨 없이 `rest`로 간다). 안 그러면 "총 0건" 아래에 로우가 서는 자기모순이 난다.
 * 입력은 `filterAndSortJobs`의 결과(최신순)라 같은 등급 안에서는 최신순이 유지된다.
 */
export function splitListAds(jobs: JobCard[]): { ads: JobCard[]; rest: JobCard[] } {
  const ads = tiersForSlot("list").flatMap((tier) => {
    const capacity = EXPOSURE_PRODUCTS[tier].weeklyCapacity ?? jobs.length;
    return jobs.filter((job) => job.featuredTier === tier).slice(0, capacity);
  });
  const adIds = new Set(ads.map((job) => job.id));
  const rest = jobs.filter((job) => !adIds.has(job.id));
  return rest.length === 0 ? { ads: [], rest: jobs } : { ads, rest };
}
