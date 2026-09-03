import { describe, expect, it } from "vitest";
import {
  daysOf,
  exposureByJob,
  findClash,
  firstFullDay,
  isAllowedStart,
  isIsoDate,
  lostCapacityRace,
  lostOverlapRace,
  overlapsExisting,
  periodsByJob,
  promotionPeriod,
  soldOn,
  startDateOptions,
  windowsByJob,
  type CapacitySpan,
  type PromotionSpan,
} from "./exposure-order";

const TODAY = "2026-09-03";

let seq = 0;
const span = (
  tier: PromotionSpan["tier"],
  startsAt: string,
  weeks: 1 | 2 | 4,
  jobId = "j",
  createdAt?: string,
): PromotionSpan => {
  seq += 1;
  return {
    jobId,
    tier,
    paymentId: `p${String(seq).padStart(3, "0")}`,
    createdAt: createdAt ?? `2026-09-01T00:00:${String(seq % 60).padStart(2, "0")}Z`,
    ...promotionPeriod(startsAt, weeks),
  };
};

describe("기간 — 시작일부터 주수 × 7일", () => {
  it("종료일은 시작일 + 7 × 주수 - 1(DB CHECK와 같은 식)", () => {
    expect(promotionPeriod(TODAY, 1)).toEqual({ startsAt: TODAY, endsAt: "2026-09-09" });
    expect(promotionPeriod(TODAY, 2).endsAt).toBe("2026-09-16");
    expect(promotionPeriod(TODAY, 4).endsAt).toBe("2026-09-30");
    expect(promotionPeriod("2026-12-30", 1).endsAt).toBe("2027-01-05"); // 연 경계
  });

  it("기간에 든 날짜를 전부 센다 — 정원은 하루 단위다", () => {
    expect(daysOf(promotionPeriod(TODAY, 1))).toHaveLength(7);
    expect(daysOf(promotionPeriod(TODAY, 4))).toHaveLength(28);
    expect(daysOf({ startsAt: TODAY, endsAt: TODAY })).toEqual([TODAY]);
  });

  it("시작일은 오늘부터 7일 — 완료 시점엔 어제까지(자정 넘겨 돌아온 복귀)", () => {
    expect(startDateOptions(TODAY)).toEqual([
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
    ]);
    expect(isAllowedStart(TODAY, TODAY)).toBe(true);
    expect(isAllowedStart("2026-09-09", TODAY)).toBe(true); // 마지막 선택지
    expect(isAllowedStart("2026-09-02", TODAY)).toBe(true); // 어제 — 자정 유예
    expect(isAllowedStart("2026-09-01", TODAY)).toBe(false);
    expect(isAllowedStart("2026-09-10", TODAY)).toBe(false); // 선택지 밖
  });

  it("날짜 모양 검사 — 결제 레코드에서 읽은 값이라 모양부터 본다", () => {
    expect(isIsoDate("2026-09-07")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("week1")).toBe(false);
    expect(isIsoDate("2026-9-7")).toBe(false);
  });
});

describe("정원 — 어느 날이든 동시에 N건", () => {
  const spans: CapacitySpan[] = [
    span("SPECIAL", "2026-09-01", 1, "a"), // 09-01 ~ 09-07
    span("SPECIAL", "2026-09-05", 2, "b"), // 09-05 ~ 09-18
    span("PLUS", "2026-09-10", 1, "c"),
  ];

  it("그날 노출 중인 건수를 센다", () => {
    expect(soldOn("SPECIAL", "2026-09-03", spans)).toBe(1);
    expect(soldOn("SPECIAL", "2026-09-06", spans)).toBe(2); // 겹치는 날
    expect(soldOn("SPECIAL", "2026-09-20", spans)).toBe(0);
    expect(soldOn("PLUS", "2026-09-03", spans)).toBe(0);
  });

  it("기간 중 처음으로 찬 날을 알려준다 — 하루라도 차면 못 판다", () => {
    const full = [...spans, span("SPECIAL", "2026-09-06", 1, "d")]; // 09-06 ~ 09-12
    // 09-06: a + b + d = 3 → 찼다
    expect(firstFullDay("SPECIAL", promotionPeriod("2026-09-03", 1), full)).toBe("2026-09-06");
    // 그 날을 지나면 다시 자리가 있다
    expect(firstFullDay("SPECIAL", promotionPeriod("2026-09-13", 1), full)).toBeNull();
    expect(firstFullDay("SPECIAL", promotionPeriod("2026-09-03", 1), spans)).toBeNull();
  });

  it("정원 없는 등급(기본)은 몇 건이든 판다", () => {
    const many = Array.from({ length: 50 }, (_, i) => span("BASIC", TODAY, 1, `b${i}`));
    expect(firstFullDay("BASIC", promotionPeriod(TODAY, 4), many)).toBeNull();
  });
});

describe("같은 공고의 기간 겹침은 막는다", () => {
  const mine = [span("BASIC", "2026-09-03", 2, "job-1")]; // 09-03 ~ 09-16

  it("겹치면 막고, 끝난 뒤 시작하면 통과", () => {
    expect(overlapsExisting("job-1", promotionPeriod("2026-09-10", 1), mine)).toBe(true);
    expect(overlapsExisting("job-1", promotionPeriod("2026-09-16", 1), mine)).toBe(true); // 마지막 날
    expect(overlapsExisting("job-1", promotionPeriod("2026-09-17", 1), mine)).toBe(false);
  });

  it("다른 공고의 구매는 상관없다", () => {
    expect(overlapsExisting("job-2", promotionPeriod("2026-09-03", 1), mine)).toBe(false);
  });

  it("겹치는 기간을 돌려준다 — 화면이 그 날짜로 안내 문구를 만든다", () => {
    const held = [{ startsAt: "2026-09-03", endsAt: "2026-09-16" }];
    expect(findClash(held, promotionPeriod("2026-09-10", 1))).toEqual(held[0]);
    expect(findClash(held, promotionPeriod("2026-09-17", 1))).toBeNull();
    expect(findClash([], promotionPeriod(TODAY, 4))).toBeNull();
  });

  it("공고별로 잡힌 기간을 모은다 — 결제 화면이 고른 공고의 것만 본다", () => {
    const spans = [
      span("BASIC", "2026-09-03", 1, "job-1"),
      span("PLUS", "2026-09-20", 1, "job-1"),
      span("SPECIAL", "2026-09-03", 1, "job-2"),
    ];
    const byJob = periodsByJob(spans, ["job-1"]);
    expect(byJob["job-1"]).toEqual([
      { startsAt: "2026-09-03", endsAt: "2026-09-09" },
      { startsAt: "2026-09-20", endsAt: "2026-09-26" },
    ]);
    expect(byJob["job-2"]).toBeUndefined();
  });
});

describe("겹침 경합 — 같은 공고에 겹치는 결제가 먼저 적혔으면 진 것", () => {
  const period = promotionPeriod(TODAY, 1);
  const ours = span("BASIC", TODAY, 1, "job-1", "2026-09-03T01:00:05Z");

  it("먼저 적힌 겹치는 결제가 있으면 졌다 — 정원 없는 기본 등급도 막힌다", () => {
    const earlier = span("BASIC", TODAY, 1, "job-1", "2026-09-03T01:00:01Z");
    expect(lostOverlapRace("job-1", period, ours, [earlier, ours])).toBe(true);
    expect(lostCapacityRace("BASIC", period, ours, [earlier, ours])).toBeNull(); // 정원은 못 잡는다
  });

  it("나중에 적힌 쪽은 우리 것이 아니다 — 한 명만 진다", () => {
    const later = span("BASIC", TODAY, 1, "job-1", "2026-09-03T01:00:09Z");
    expect(lostOverlapRace("job-1", period, ours, [ours, later])).toBe(false);
  });

  it("다른 공고이거나 기간이 안 겹치면 상관없다", () => {
    const other = span("BASIC", TODAY, 1, "job-2", "2026-09-03T01:00:01Z");
    const apart = span("BASIC", "2026-09-20", 1, "job-1", "2026-09-03T01:00:01Z");
    expect(lostOverlapRace("job-1", period, ours, [other, apart, ours])).toBe(false);
  });
});

describe("공고별 지금 노출 — 오늘을 덮으면 노출 중, 아니면 예약", () => {
  it("오늘을 덮는 구매가 노출 중이 된다", () => {
    const map = exposureByJob([span("PLUS", "2026-09-01", 1, "a")], TODAY);
    expect(map.get("a")).toEqual({
      tier: "PLUS",
      startsAt: "2026-09-01",
      endsAt: "2026-09-07",
      active: true,
    });
  });

  it("아직 시작 전이면 예약이다 — 오늘 광고 자리에 서면 안 된다", () => {
    const map = exposureByJob([span("SPECIAL", "2026-09-07", 1, "a")], TODAY);
    expect(map.get("a")?.active).toBe(false);
    expect(map.get("a")?.startsAt).toBe("2026-09-07");
  });

  it("끝난 구매는 아예 안 잡힌다", () => {
    expect(exposureByJob([span("SPECIAL", "2026-08-01", 1, "a")], TODAY).get("a")).toBeUndefined();
  });

  it("노출 중이 예약을 이기고, 둘 다 노출 중이면 높은 등급", () => {
    const spans = [
      span("BASIC", "2026-09-01", 1, "a"), // 노출 중
      span("SPECIAL", "2026-09-20", 1, "a"), // 예약
    ];
    expect(exposureByJob(spans, TODAY).get("a")?.tier).toBe("BASIC");

    const both = [span("BASIC", "2026-09-01", 1, "b"), span("SPECIAL", "2026-09-02", 1, "b")];
    expect(exposureByJob(both, TODAY).get("b")?.tier).toBe("SPECIAL");
  });

  it("예약이 여럿이면 가장 이른 것", () => {
    const spans = [span("PLUS", "2026-09-20", 1, "a"), span("PLUS", "2026-09-08", 1, "a")];
    expect(exposureByJob(spans, TODAY).get("a")?.startsAt).toBe("2026-09-08");
  });

  it("교회 화면은 남은 창을 **전부** 본다 — 시작일순, 지난 것만 빠진다", () => {
    const spans = [
      span("PLUS", "2026-09-20", 1, "a"), // 예약
      span("BASIC", "2026-09-01", 1, "a"), // 노출 중
      span("SPECIAL", "2026-08-01", 1, "a"), // 끝났다
    ];
    expect(windowsByJob(spans, TODAY).get("a")).toEqual([
      { tier: "BASIC", startsAt: "2026-09-01", endsAt: "2026-09-07", active: true },
      { tier: "PLUS", startsAt: "2026-09-20", endsAt: "2026-09-26", active: false },
    ]);
  });
});

describe("경합 — 적은 뒤 다시 읽어 먼저 적힌 행이 정원을 채웠으면 진 것", () => {
  const period = promotionPeriod(TODAY, 1);
  const earlier = [
    span("SPECIAL", TODAY, 1, "a", "2026-09-03T01:00:00Z"),
    span("SPECIAL", TODAY, 1, "b", "2026-09-03T01:00:01Z"),
  ];
  const ours = span("SPECIAL", TODAY, 1, "me", "2026-09-03T01:00:05Z");

  it("먼저 적힌 행이 정원 미만이면 이겼다", () => {
    expect(lostCapacityRace("SPECIAL", period, ours, [...earlier, ours])).toBeNull();
  });

  it("먼저 적힌 행이 정원을 채웠으면 그날 졌다 — 나중 행은 세지 않는다", () => {
    const third = span("SPECIAL", TODAY, 1, "c", "2026-09-03T01:00:02Z");
    const later = span("SPECIAL", TODAY, 1, "d", "2026-09-03T01:00:09Z");
    expect(lostCapacityRace("SPECIAL", period, ours, [...earlier, third, ours, later])).toBe(TODAY);

    // 같은 순간이면 결제번호 순 — 어느 쪽에서 봐도 한 명만 진다
    const same = span("SPECIAL", TODAY, 1, "s", ours.createdAt);
    const tie = { ...same, paymentId: ours.paymentId < same.paymentId ? "zzz" : "aaa" };
    expect(lostCapacityRace("SPECIAL", period, ours, [...earlier, tie, ours])).toBe(
      tie.paymentId < ours.paymentId ? TODAY : null,
    );
  });

  it("정원 없는 등급은 경합이 없다", () => {
    const basics = Array.from({ length: 10 }, (_, i) =>
      span("BASIC", TODAY, 1, `b${i}`, "2026-09-03T00:00:00Z"),
    );
    expect(lostCapacityRace("BASIC", period, ours, [...basics, ours])).toBeNull();
  });
});
