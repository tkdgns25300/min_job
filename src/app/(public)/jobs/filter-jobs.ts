import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  POSITIONS,
  QUALIFICATIONS,
  REGIONS,
} from "@/constants/domain";
import { normalizeChurchName } from "@/lib/job-church";
import type { FilterDim, JobCard } from "@/types/domain";

// mock 단계 클라이언트 필터/정렬 (순수 함수).
// 실제 데이터 연동 시 이 로직은 lib/queries의 서버 쿼리로 이전한다.

const TIER_RANK = { HERO: 0, PREMIUM: 1, NONE: 2 } as const;

export interface JobFilterCriteria {
  q: string;
  selected: Record<FilterDim, Set<string>>;
  payMin: number | null;
  payMax: number | null;
  includeNego: boolean;
  housingOnly: boolean;
}

export function filterAndSortJobs(jobs: JobCard[], c: JobFilterCriteria): JobCard[] {
  const query = c.q.trim();
  const s = c.selected;

  const result = jobs.filter((j) => {
    // 미상(null)은 축을 고른 순간 탈락한다 — 모르는 값을 아무 칸에나 넣으면 필터가 거짓말이 된다.
    // (지역 미상 공고가 사실상 안 보이게 되는 건 알고 있는 대가 — 검수에서 먼저 채운다, DATA §3)
    if (s.denomination.size && !s.denomination.has(j.church.denomination ?? "")) return false;
    if (s.region.size && !s.region.has(j.church.region ?? "")) return false;
    if (s.position.size && !j.position.some((p) => s.position.has(p))) return false;
    if (s.department.size && (!j.department || !s.department.has(j.department))) return false;
    if (s.employmentType.size && !s.employmentType.has(j.employmentType)) return false;
    if (s.qualification.size && (!j.qualification || !s.qualification.has(j.qualification)))
      return false;
    if (c.housingOnly && !j.housingProvided) return false;

    const hasNumber = j.payMin !== null || j.payMax !== null;
    if (!hasNumber) {
      if (!c.includeNego) return false;
    } else {
      const jMax = j.payMax ?? j.payMin ?? 0;
      const jMin = j.payMin ?? j.payMax ?? 0;
      if (c.payMin !== null && jMax < c.payMin) return false;
      if (c.payMax !== null && jMin > c.payMax) return false;
    }

    if (query) {
      // 자유검색 매칭 소스 = 교회명·제목·지역·도시 + 직분·부서·교단·고용형태 라벨
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
        j.department ? DEPARTMENTS[j.department] : "",
        j.church.denomination ? DENOMINATIONS[j.church.denomination] : "",
        EMPLOYMENT_TYPES[j.employmentType],
        j.qualification ? QUALIFICATIONS[j.qualification] : "",
      ].join(" ");
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  // 노출 등급(대표광고 → 프리미엄 → 일반) 먼저, 그 안에서 최신순.
  // 등급은 정렬 옵션이 아니라 **유료 상품의 근거**라 사용자가 바꿀 수 없다(SPEC 정렬·필터 규칙).
  result.sort((a, b) => {
    const tier = TIER_RANK[a.featuredTier] - TIER_RANK[b.featuredTier];
    return tier !== 0 ? tier : b.postedAt.localeCompare(a.postedAt);
  });
  return result;
}
