import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  POSITIONS,
  QUALIFICATIONS,
  REGIONS,
} from "@/constants/domain";
import type { FilterDim, JobCard, SortKey } from "@/types/domain";

// mock 단계 클라이언트 필터/정렬 (순수 함수).
// 실제 데이터 연동 시 이 로직은 lib/queries의 서버 쿼리로 이전한다.

const TIER_RANK = { HERO: 0, PREMIUM: 1, NONE: 2 } as const;
const FAR_FUTURE = "9999-12-31"; // 마감 없는 공고를 마감임박 정렬 맨 뒤로

export interface JobFilterCriteria {
  q: string;
  selected: Record<FilterDim, Set<string>>;
  payMin: number | null;
  payMax: number | null;
  includeNego: boolean;
  housingOnly: boolean;
  sort: SortKey;
}

export function filterAndSortJobs(jobs: JobCard[], c: JobFilterCriteria): JobCard[] {
  const query = c.q.trim();
  const s = c.selected;

  const result = jobs.filter((j) => {
    if (s.denomination.size && !s.denomination.has(j.church.denomination)) return false;
    if (s.region.size && !s.region.has(j.church.region)) return false;
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
        j.title,
        REGIONS[j.church.region],
        j.church.city ?? "",
        ...j.position.map((p) => POSITIONS[p]),
        j.department ? DEPARTMENTS[j.department] : "",
        DENOMINATIONS[j.church.denomination],
        EMPLOYMENT_TYPES[j.employmentType],
        j.qualification ? QUALIFICATIONS[j.qualification] : "",
      ].join(" ");
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  // 대표광고 → 프리미엄 → 일반 순 고정 후 선택 정렬
  result.sort((a, b) => {
    const tier = TIER_RANK[a.featuredTier] - TIER_RANK[b.featuredTier];
    if (tier !== 0) return tier;
    if (c.sort === "pay") {
      return (b.payMax ?? b.payMin ?? -1) - (a.payMax ?? a.payMin ?? -1);
    }
    if (c.sort === "deadline") {
      return (a.deadline ?? FAR_FUTURE).localeCompare(b.deadline ?? FAR_FUTURE);
    }
    return b.postedAt.localeCompare(a.postedAt);
  });
  return result;
}
