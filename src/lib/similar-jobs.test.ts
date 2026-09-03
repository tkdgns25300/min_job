import { describe, expect, it } from "vitest";
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

describe("첫 칸 광고 — 문 통과 + 같은 지역 + 유료 노출 중", () => {
  const paid = (over: Partial<SimilarCandidate> = {}) =>
    candidate({ featuredTier: "BASIC", ...over });

  it("조건을 만족하는 유료 공고가 첫 칸에 서고 유기 목록에서는 빠진다", () => {
    const ad = paid();
    const organic = Array.from({ length: 6 }, () => candidate());
    const pick = pickSimilarJobs(base, [ad, ...organic], 6);
    expect(pick.ad?.id).toBe(ad.id);
    expect(pick.organic).toHaveLength(5);
    expect(ids(pick.organic)).not.toContain(ad.id);
  });

  it("다른 지역 유료 공고는 광고가 아니다 — 유기 후보로만 남는다", () => {
    const farAd = paid({ region: "BUSAN" });
    const pick = pickSimilarJobs(base, [farAd], 6);
    expect(pick.ad).toBeNull();
    expect(ids(pick.organic)).toEqual([farAd.id]);
  });

  it("오늘 노출 중이 아닌 공고는 광고가 아니다 — seam이 등급을 NONE으로 내려보낸다", () => {
    const notToday = paid({ featuredTier: "NONE" });
    expect(pickSimilarJobs(base, [notToday], 6).ad).toBeNull();
  });

  it("문을 못 넘는 유료 공고(직분 불일치)는 광고가 아니다", () => {
    const pastorAd = paid({ position: ["ASSOCIATE_PASTOR"] });
    expect(pickSimilarJobs(base, [pastorAd], 6).ad).toBeNull();
  });

  it("지역 미상 기준 공고에는 광고가 서지 않는다", () => {
    const unknownRegion = candidate({ id: "b3", region: null });
    expect(pickSimilarJobs(unknownRegion, [paid()], 6).ad).toBeNull();
  });

  it("여럿이면 기준 공고 id로 결정적으로 하나를 고른다 — 같은 입력이면 늘 같은 광고", () => {
    const ads = [paid(), paid(), paid()];
    const first = pickSimilarJobs(base, ads, 6).ad?.id;
    const again = pickSimilarJobs(base, [...ads].reverse(), 6).ad?.id;
    expect(first).toBe(again);
    // 다른 기준 공고들은 서로 다른 광고를 고를 수 있다(페이지마다 나눠 보이는 근거) — 셋 중 둘 이상이 나온다
    const chosen = new Set(
      ["p1", "p2", "p3", "p4", "p5", "p6"].map(
        (id) => pickSimilarJobs(candidate({ id }), ads, 6).ad?.id,
      ),
    );
    expect(chosen.size).toBeGreaterThan(1);
  });
});
