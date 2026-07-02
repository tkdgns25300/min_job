import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  POSITIONS,
  REGIONS,
  UNKNOWN_SIZE,
} from "@/constants/domain";
import type { FilterDim, JobCard, SortKey } from "@/types/domain";

// mock 단계 클라이언트 필터/정렬 (순수 함수).
// 실제 데이터 연동 시 이 로직은 lib/queries의 서버 쿼리로 이전한다.

const TIER_RANK = { HERO: 0, PREMIUM: 1, NONE: 2 } as const;
const FAR_FUTURE = "9999-12-31"; // 마감 없는 공고를 마감임박 정렬 맨 뒤로

export interface JobFilterCriteria {
  q: string;
  selected: Record<FilterDim, Set<string>>;
  stipendMin: number | null;
  stipendMax: number | null;
  includeNego: boolean;
  sort: SortKey;
}

export function filterAndSortJobs(jobs: JobCard[], c: JobFilterCriteria): JobCard[] {
  const query = c.q.trim();
  const s = c.selected;

  const result = jobs.filter((j) => {
    if (j.featuredTier === "HERO") return false; // 대표광고는 목록이 아닌 상단 AD 섹션에서 노출
    if (s.denomination.size && !s.denomination.has(j.church.denomination)) return false;
    if (s.region.size && !s.region.has(j.church.region)) return false;
    if (s.position.size && !s.position.has(j.position)) return false;
    if (s.department.size && (!j.department || !s.department.has(j.department))) return false;
    if (s.employmentType.size && !s.employmentType.has(j.employmentType)) return false;
    if (s.size.size && !s.size.has(j.church.size ?? UNKNOWN_SIZE)) return false;

    const hasNumber = j.stipendMin !== null || j.stipendMax !== null;
    if (!hasNumber) {
      if (!c.includeNego) return false;
    } else {
      const jMax = j.stipendMax ?? j.stipendMin ?? 0;
      const jMin = j.stipendMin ?? j.stipendMax ?? 0;
      if (c.stipendMin !== null && jMax < c.stipendMin) return false;
      if (c.stipendMax !== null && jMin > c.stipendMax) return false;
    }

    if (query) {
      // 자유검색 매칭 소스 = 교회명·제목·지역·도시 + 직분·부서·교단·고용형태 라벨
      // (검색어 완성 후보와 소스를 맞춰, 제안한 검색어가 반드시 결과로 이어지게 한다)
      const hay = [
        j.church.name,
        j.title,
        REGIONS[j.church.region],
        j.church.city ?? "",
        POSITIONS[j.position],
        j.department ? DEPARTMENTS[j.department] : "",
        DENOMINATIONS[j.church.denomination],
        EMPLOYMENT_TYPES[j.employmentType],
      ].join(" ");
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  // 프리미엄 → 일반 순 고정 후 선택 정렬 (대표광고는 위에서 제외됨)
  result.sort((a, b) => {
    const tier = TIER_RANK[a.featuredTier] - TIER_RANK[b.featuredTier];
    if (tier !== 0) return tier;
    if (c.sort === "stipend") {
      return (b.stipendMax ?? b.stipendMin ?? -1) - (a.stipendMax ?? a.stipendMin ?? -1);
    }
    if (c.sort === "deadline") {
      return (a.deadline ?? FAR_FUTURE).localeCompare(b.deadline ?? FAR_FUTURE);
    }
    return b.postedAt.localeCompare(a.postedAt);
  });
  return result;
}
