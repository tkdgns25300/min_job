import { describe, expect, it } from "vitest";
import type { JobCard } from "@/types/domain";
import { splitListAds } from "./filter-jobs";

let seq = 0;
function card(over: Partial<JobCard> = {}): JobCard {
  seq += 1;
  return {
    id: `job-${String(seq).padStart(3, "0")}`,
    isPubliclyOpen: true,
    title: `공고 ${seq}`,
    church: { name: `교회${seq}`, denomination: "HAPDONG", region: "SEOUL", city: null },
    position: ["EVANGELIST"],
    role: null,
    department: null,
    employmentType: null,
    qualification: null,
    housingProvided: null,
    payMin: null,
    payMax: null,
    payNote: null,
    payPeriod: "MONTH",
    featuredTier: "NONE",
    postedAt: "2026-09-01",
    deadline: null,
    ...over,
  };
}
const ids = (list: JobCard[]) => list.map((c) => c.id);

describe("splitListAds — 1페이지 맨 위 광고 로우", () => {
  it("스페셜이 플러스보다 앞서고, 같은 등급 안에서는 입력 순서(최신순)를 지킨다", () => {
    const plus1 = card({ featuredTier: "PLUS" });
    const special1 = card({ featuredTier: "SPECIAL" });
    const plus2 = card({ featuredTier: "PLUS" });
    const special2 = card({ featuredTier: "SPECIAL" });
    const { ads } = splitListAds([plus1, special1, plus2, special2, card()]);
    expect(ids(ads)).toEqual([special1.id, special2.id, plus1.id, plus2.id]);
  });

  it("기본 등급은 목록 자리가 없다 — 일반 로우로 남는다", () => {
    const basic = card({ featuredTier: "BASIC" });
    const { ads, rest } = splitListAds([basic]);
    expect(ads).toEqual([]);
    expect(ids(rest)).toEqual([basic.id]);
  });

  it("등급마다 주 정원까지만(스페셜 3 · 플러스 2) — 넘치는 광고는 일반 로우로 내려간다", () => {
    const specials = Array.from({ length: 4 }, () => card({ featuredTier: "SPECIAL" }));
    const pluses = Array.from({ length: 3 }, () => card({ featuredTier: "PLUS" }));
    const organic = card();
    const { ads, rest } = splitListAds([...pluses, ...specials, organic]);
    expect(ids(ads)).toEqual([...ids(specials.slice(0, 3)), pluses[0].id, pluses[1].id]);
    // 스페셜이 넘쳐도 플러스 자리를 먹지 않는다 — 넷째 스페셜은 일반 로우로
    expect(ids(rest)).toEqual([pluses[2].id, specials[3].id, organic.id]);
  });

  it("결과가 광고뿐이면 광고 자리가 없다 — 전부 일반 결과로 센다", () => {
    const onlyAds = [card({ featuredTier: "SPECIAL" }), card({ featuredTier: "PLUS" })];
    const { ads, rest } = splitListAds(onlyAds);
    expect(ads).toEqual([]);
    expect(ids(rest)).toEqual(ids(onlyAds));
  });

  it("일반 로우는 광고를 뺀 나머지이고 순서가 바뀌지 않는다 — '총 N건'의 근거", () => {
    const a = card();
    const ad = card({ featuredTier: "PLUS" });
    const b = card();
    const { ads, rest } = splitListAds([a, ad, b]);
    expect(ids(ads)).toEqual([ad.id]);
    expect(ids(rest)).toEqual([a.id, b.id]);
  });
});
