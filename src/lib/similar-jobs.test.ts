import { describe, expect, it } from "vitest";
import { SIMILAR_AD_SLOTS } from "@/constants/domain";
import { pickSimilarJobs, type SimilarCandidate } from "./similar-jobs";

let seq = 0;
function candidate(over: Partial<SimilarCandidate> = {}): SimilarCandidate {
  seq += 1;
  return {
    id: `job-${String(seq).padStart(3, "0")}`,
    churchId: null,
    churchName: `교회${seq}`,
    jobKind: ["MINISTRY"],
    position: ["EVANGELIST"],
    denomination: "HAPDONG",
    region: "GYEONGGI",
    department: "YOUTH",
    employmentType: "FULL_TIME",
    featuredTier: "NONE",
    postedAt: "2026-09-01",
    ...over,
  };
}

const base = candidate({ id: "base", churchName: "기준교회" });
const ids = (list: SimilarCandidate[]) => list.map((c) => c.id);

describe("문(자격) — 통과 못 하면 가까워도 안 보인다", () => {
  it("사역직 공고에 일반직 후보는 어떤 단계에서도 섞이지 않는다", () => {
    const general = candidate({ jobKind: ["GENERAL"], position: [] });
    const pick = pickSimilarJobs(base, [general], 6);
    expect(pick.organic).toEqual([]);
  });

  it("직분이 하나도 안 겹치면 엄격 단계에서 탈락한다 — 겹치는 후보가 먼저 선다", () => {
    const pastor = candidate({ position: ["ASSOCIATE_PASTOR"], region: base.region });
    const evangelist = candidate({ region: null, department: null, employmentType: null });
    const pick = pickSimilarJobs(base, [pastor, evangelist], 6);
    // 점수는 pastor(지역 +3)가 높지만 문을 못 넘어 보충 단계로 밀린다
    expect(ids(pick.organic)).toEqual([evangelist.id, pastor.id]);
  });

  it("직분은 양쪽 다 있을 때만 대조한다 — 혼합 공고 페이지에 일반직 공고가 문을 넘는다", () => {
    const mixedBase = candidate({ id: "mixed", jobKind: ["MINISTRY", "GENERAL"] });
    const generalOnly = candidate({ jobKind: ["GENERAL"], position: [] });
    const pick = pickSimilarJobs(mixedBase, [generalOnly], 6);
    expect(ids(pick.organic)).toEqual([generalOnly.id]);
  });

  it("교단은 둘 다 밝혀졌는데 다를 때만 탈락 — 미상은 통과한다", () => {
    const other = candidate({ denomination: "TONGHAP" });
    const unknown = candidate({ denomination: null });
    const pick = pickSimilarJobs(base, [other, unknown], 1);
    expect(ids(pick.organic)).toEqual([unknown.id]);
  });

  it("같은 교회의 다른 공고는 뺀다", () => {
    const sameChurch = candidate({ churchName: "기준교회" });
    const pick = pickSimilarJobs(base, [sameChurch], 6);
    expect(pick.organic).toEqual([]);
  });
});

describe("점수(선호) — 같은 지역 3 · 교단 2 · 부서 2 · 고용형태 1, 동점은 최신순", () => {
  it("지역이 같은 것이 부서·고용형태가 같은 것보다 앞선다", () => {
    const deptAndType = candidate({ region: "SEOUL" }); // 교단2 + 부서2 + 고용1 = 5
    const regionOnly = candidate({
      department: null,
      employmentType: null,
      denomination: null,
    }); // 지역 3
    const regionAndDenom = candidate({ department: null, employmentType: null }); // 3 + 2 = 5
    const pick = pickSimilarJobs(base, [deptAndType, regionOnly, regionAndDenom], 6);
    // 5점 둘이 동점 → 최신순(같은 날이면 id순), 그다음 3점
    expect(ids(pick.organic)).toEqual([deptAndType.id, regionAndDenom.id, regionOnly.id]);
  });

  it("동점이면 최신 공고가 먼저다", () => {
    const older = candidate({ postedAt: "2026-08-01" });
    const newer = candidate({ postedAt: "2026-09-02" });
    const pick = pickSimilarJobs(base, [older, newer], 6);
    expect(ids(pick.organic)).toEqual([newer.id, older.id]);
  });

  it("미상끼리는 '같다'로 치지 않는다", () => {
    const unknownBase = candidate({ id: "b2", region: null, department: null });
    const alsoUnknown = candidate({ region: null, department: null, postedAt: "2026-08-01" });
    const known = candidate({ region: "SEOUL", department: "CHILDREN", postedAt: "2026-07-01" });
    const pick = pickSimilarJobs(unknownBase, [alsoUnknown, known], 6);
    // 둘 다 지역·부서 점수 0 → 교단 2 + 고용 1로 동점 → 최신순
    expect(ids(pick.organic)).toEqual([alsoUnknown.id, known.id]);
  });
});

describe("보충 — 6장이 안 채워지면 직분 → 교단 순으로 문을 연다", () => {
  it("엄격 통과분을 다 쓴 뒤에만 다음 단계가 붙고, 순서는 단계 안에서 점수순이다", () => {
    const strict = candidate();
    const otherPosition = candidate({ position: ["ASSOCIATE_PASTOR"] });
    const otherDenomination = candidate({ denomination: "TONGHAP", region: "SEOUL" });
    const pick = pickSimilarJobs(base, [otherDenomination, otherPosition, strict], 6);
    expect(ids(pick.organic)).toEqual([strict.id, otherPosition.id, otherDenomination.id]);
  });

  it("limit을 넘기지 않는다", () => {
    const pool = Array.from({ length: 10 }, () => candidate());
    expect(pickSimilarJobs(base, pool, 6).organic).toHaveLength(6);
  });
});

describe("상단 광고 칸 — 문 통과 + 같은 지역 + 유료 노출 중", () => {
  const paid = (over: Partial<SimilarCandidate> = {}) =>
    candidate({ featuredTier: "BASIC", ...over });
  const byId = (a: string, b: string) => a.localeCompare(b);

  it("조건을 만족하는 유료 공고가 위 칸에 서고 유기 목록에서는 빠진다", () => {
    const ad = paid();
    const organic = Array.from({ length: 6 }, () => candidate());
    const pick = pickSimilarJobs(base, [ad, ...organic], 6);
    expect(ids(pick.ads)).toEqual([ad.id]);
    expect(pick.organic).toHaveLength(5); // 광고가 하나면 남는 칸은 유기가 채운다 — 합은 늘 6
    expect(ids(pick.organic)).not.toContain(ad.id);
  });

  it("광고가 3곳까지는 전부 위 칸에 선다 — 유기는 3장", () => {
    const ads = [paid(), paid(), paid()];
    const organic = Array.from({ length: 6 }, () => candidate());
    const pick = pickSimilarJobs(base, [...ads, ...organic], 6);
    expect(ids(pick.ads).sort(byId)).toEqual(ids(ads).sort(byId));
    expect(pick.organic).toHaveLength(3);
  });

  it("광고가 3곳을 넘으면 3칸만 광고고, 밀린 광고는 유기 후보로 남는다", () => {
    const ads = [paid(), paid(), paid(), paid(), paid()];
    const pick = pickSimilarJobs(base, ads, 6);
    expect(pick.ads).toHaveLength(SIMILAR_AD_SLOTS);
    expect(pick.organic).toHaveLength(2); // 광고 칸을 못 받은 둘 — 같은 페이지에 두 번 서지는 않는다
    expect(new Set([...ids(pick.ads), ...ids(pick.organic)]).size).toBe(5);
  });

  it("3칸은 id 순 후보에서 **연달아** 가져온다 — 끝을 넘으면 처음으로(당번표)", () => {
    const ads = [paid(), paid(), paid(), paid(), paid(), paid()];
    const sorted = ids(ads).sort(byId);
    for (const pageId of ["p1", "p2", "p3", "p4", "p5", "p6"]) {
      const picked = ids(pickSimilarJobs(candidate({ id: pageId }), ads, 6).ads);
      const start = sorted.indexOf(picked[0]);
      expect(picked).toEqual([0, 1, 2].map((k) => sorted[(start + k) % sorted.length]));
    }
  });

  it("`limit`이 광고 칸보다 작으면 광고도 그만큼만 — 합이 청한 장 수를 넘지 않는다", () => {
    const pick = pickSimilarJobs(base, [paid(), paid(), paid(), paid()], 2);
    expect(pick.ads).toHaveLength(2);
    expect(pick.organic).toHaveLength(0);
  });

  it("다른 지역 유료 공고는 광고가 아니다 — 유기 후보로만 남는다", () => {
    const farAd = paid({ region: "BUSAN" });
    const pick = pickSimilarJobs(base, [farAd], 6);
    expect(pick.ads).toEqual([]);
    expect(ids(pick.organic)).toEqual([farAd.id]);
  });

  it("오늘 노출 중이 아닌 공고는 광고가 아니다 — seam이 등급을 NONE으로 내려보낸다", () => {
    expect(pickSimilarJobs(base, [paid({ featuredTier: "NONE" })], 6).ads).toEqual([]);
  });

  it("문을 못 넘는 유료 공고(직분 불일치)는 광고가 아니다", () => {
    expect(pickSimilarJobs(base, [paid({ position: ["ASSOCIATE_PASTOR"] })], 6).ads).toEqual([]);
  });

  it("지역 미상 기준 공고에는 광고가 서지 않는다", () => {
    const unknownRegion = candidate({ id: "b3", region: null });
    expect(pickSimilarJobs(unknownRegion, [paid()], 6).ads).toEqual([]);
  });

  it("같은 입력이면 늘 같은 광고 — 후보를 거꾸로 넣어도", () => {
    const ads = [paid(), paid(), paid(), paid()];
    const first = ids(pickSimilarJobs(base, ads, 6).ads);
    const again = ids(pickSimilarJobs(base, [...ads].reverse(), 6).ads);
    expect(first).toEqual(again);
  });

  it("여럿이 겹치면 페이지마다 나눠 갖는다 — 6곳·600페이지면 각자 절반 안팎", () => {
    const ads = [paid(), paid(), paid(), paid(), paid(), paid()];
    const count = new Map(ids(ads).map((id) => [id, 0]));
    const pages = 600;
    for (let i = 0; i < pages; i++) {
      for (const id of ids(pickSimilarJobs(candidate({ id: `page-${i}` }), ads, 6).ads)) {
        count.set(id, (count.get(id) ?? 0) + 1);
      }
    }
    // 3/6 = 50%가 목표. 한 곳이 독식하거나(99%) 굶으면(1%) 여기서 잡힌다
    for (const n of count.values()) {
      expect(n / pages).toBeGreaterThan(0.4);
      expect(n / pages).toBeLessThan(0.6);
    }
  });
});
