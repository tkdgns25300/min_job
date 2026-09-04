import { SIMILAR_AD_SLOTS, tiersForSlot, type FeaturedTier } from "@/constants/domain";
import { churchIdentityKey } from "@/lib/job-church";
import type { Job, JobCard } from "@/types/domain";

// 비슷한 공고 = **같은 자격으로 갈 수 있는 자리 중 가까운 것**(확정 2026-09-02 · SPEC 공고 상세 절).
// 순수 함수 — seam(`getSimilarJobs`)이 후보를 넘기고 결과를 카드로 바꾼다. 여기는 DB도 캐시도 모른다.
//
// 세 단계다. ① **문(자격)**: 통과 못 하면 아무리 가까워도 안 보인다 — 전도사 페이지에 부목사 공고가 넷 오던
// 옛 규칙(부서 → 지역 → 직분)의 실측이 이 문을 만들었다. ② **점수(선호)**: 문을 통과한 것끼리 가까운 순.
// ③ **보충**: 6장이 안 채워지면 문을 한 단계씩 연다 — 직분, 그다음 교단. 사역직/일반직은 끝까지 안 섞는다.
// 실측 889건이 전부 ①에서 채워져 보충은 보험이다.
//
// **위 3칸은 광고 자리**다(SPEC 수익화 절 · `SIMILAR_AD_SLOTS`): 이 페이지의 문을
// 통과하고 **같은 지역**인 유료 공고가 그 칸에 선다. 등급은 보지 않는다 — 스페셜·기본이 여기서는 같은 한 표다.
// 여럿이면 **당번표**로 나눈다: 후보를 id로 세우고 기준 공고 id의 해시를 시작점으로 연달아 3곳을 가져간다
// (끝을 넘으면 처음으로). 상세가 캐시라 로드마다 바뀌는 로테이션은 쓸 수 없고, 시작점이 고르게 흩어지면
// 각 후보의 몫도 고르다 — 실측 2026-09-05: 공개 공고 953장의 시작점 `%6` 분포가 16.7% ±2%p.
// ⚠️ "페이지 id + 광고 id"를 이어 붙여 해시하는 방식은 쓰지 않는다 — djb2는 뒷글자가 결과를 좌우해 이어 붙이는
//    순서에 따라 한 곳이 99%를 독식했다(같은 날 실측). 페이지 id 하나만 해시하고 나머지는 나눗셈이 한다.

/**
 * 판정에 쓰는 필드만 — 카드 컬럼(`JobCardFields`)에 **오늘 등급**을 얹은 모양이다.
 * 등급은 공고의 칸이 아니라 원장에서 오므로 seam이 채워 넘긴다(2026-09-03).
 */
export type SimilarCandidate = Pick<
  Job,
  | "id"
  | "churchId"
  | "churchName"
  | "jobKind"
  | "position"
  | "denomination"
  | "region"
  | "department"
  | "employmentType"
  | "postedAt"
> &
  Pick<JobCard, "featuredTier">;

export interface SimilarPick<T> {
  /** 위 칸 광고들(최대 `SIMILAR_AD_SLOTS`). 문 통과 + 같은 지역인 유료 공고가 없으면 빈 배열 */
  ads: T[];
  /** 점수순 유기 결과. 광고 수만큼 적게 담아 합이 `limit`이 된다 */
  organic: T[];
}

// 문 — 교단은 **둘 다 밝혀졌는데 다를 때만** 탈락이다. 미상(25%)을 막으면 넷 중 하나가 어디에도 못 뜬다.
const sameKind = (a: SimilarCandidate, b: SimilarCandidate) =>
  a.jobKind.some((k) => b.jobKind.includes(k));
// 직분도 **양쪽 다 있을 때만** 대조한다 — 일반직 공고는 직분이 없다(직무만 · DB CHECK ①). 한쪽만 보면
// 사역직+일반직 혼합 공고의 페이지에 일반직 공고가 끝까지 못 서고, 그 공고가 기본 등급을 사도 광고 칸에 못 선다.
const samePosition = (a: SimilarCandidate, b: SimilarCandidate) =>
  a.position.length === 0 ||
  b.position.length === 0 ||
  a.position.some((p) => b.position.includes(p));
const denominationCompatible = (a: SimilarCandidate, b: SimilarCandidate) =>
  a.denomination === null || b.denomination === null || a.denomination === b.denomination;

// 보충 단계 — 위부터 차례로 연다. 사역직/일반직(`sameKind`)은 모든 단계에 남는다.
const GATES: ReadonlyArray<(base: SimilarCandidate, c: SimilarCandidate) => boolean> = [
  (base, c) => sameKind(base, c) && samePosition(base, c) && denominationCompatible(base, c),
  (base, c) => sameKind(base, c) && denominationCompatible(base, c),
  (base, c) => sameKind(base, c),
];

// 점수 — 둘 다 밝혀졌고 같을 때만 더한다(미상끼리 "같다"고 치지 않는다)
const both = <V>(a: V | null, b: V | null) => a !== null && b !== null && a === b;
function score(base: SimilarCandidate, c: SimilarCandidate): number {
  return (
    (both(base.region, c.region) ? 3 : 0) +
    (both(base.denomination, c.denomination) ? 2 : 0) +
    (both(base.department, c.department) ? 2 : 0) +
    (both(base.employmentType, c.employmentType) ? 1 : 0)
  );
}

/** 문자열 → 음이 아닌 정수. 결정적이면 충분해서 단순한 djb2 */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

// 연관 광고 칸에 설 수 있는 등급 — 상품 정의(`slots.related`)가 정본이다(홈·목록이 자기 자리 표를 보는 것과 같다)
const RELATED_TIERS = new Set<FeaturedTier>(tiersForSlot("related"));

export function pickSimilarJobs<T extends SimilarCandidate>(
  base: SimilarCandidate,
  pool: readonly T[],
  limit: number,
): SimilarPick<T> {
  // ⚠️ 같은 교회 판정에 `churchId` 비교를 쓰면 안 된다 — 미claim 크롤 공고끼리는 둘 다 null이라 무관한
  //    교회가 통째로 걸러진다. `churchIdentityKey`가 미claim은 이름+지역으로 가른다(lib/job-church).
  const baseKey = churchIdentityKey(base);
  const others = pool.filter((c) => c.id !== base.id && churchIdentityKey(c) !== baseKey);

  const strict = others.filter((c) => GATES[0](base, c));

  // 광고 — 문 통과 + 같은 지역(둘 다 밝혀진 경우) + 연관 자리를 가진 등급으로 오늘 노출 중.
  // id로 세운 뒤 기준 공고 id의 해시를 시작점으로 연달아 가져간다(당번표 · 머리말). 후보가 칸보다 적으면 있는 만큼만
  const adPool = strict
    .filter((c) => RELATED_TIERS.has(c.featuredTier) && both(base.region, c.region))
    .sort((a, b) => a.id.localeCompare(b.id));
  const start = adPool.length > 0 ? hashString(base.id) % adPool.length : 0;
  const ads = Array.from(
    // `limit`도 상한이다 — 광고 칸이 부르는 쪽이 청한 장 수를 넘어서는 안 된다
    { length: Math.min(SIMILAR_AD_SLOTS, adPool.length, limit) },
    (_, k) => adPool[(start + k) % adPool.length],
  );

  const organicLimit = limit - ads.length;
  const byCloseness = (a: T, b: T) =>
    score(base, b) - score(base, a) ||
    b.postedAt.localeCompare(a.postedAt) ||
    a.id.localeCompare(b.id);

  const organic: T[] = [];
  const taken = new Set<string>(ads.map((a) => a.id));
  for (const [i, gate] of GATES.entries()) {
    if (organic.length >= organicLimit) break;
    const passing = i === 0 ? strict : others.filter((c) => gate(base, c));
    const stage = passing.filter((c) => !taken.has(c.id)).sort(byCloseness);
    for (const c of stage) {
      if (organic.length >= organicLimit) break;
      organic.push(c);
      taken.add(c.id);
    }
  }
  return { ads, organic };
}
