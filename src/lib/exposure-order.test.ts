import { describe, expect, it } from "vitest";
import {
  daysLeftInWeek,
  firstFullWeek,
  isAllowedStart,
  isExtension,
  isIsoDate,
  lostCapacityRace,
  mondayOf,
  pendingWindow,
  promotionPeriod,
  soldInWeek,
  startWeekOptions,
  weeklySales,
  weeksOf,
  type PromotionSpan,
} from "./exposure-order";

// 2026-09-03은 목요일이다. 그 주 월요일 = 08-31, 다음 주 월요일 = 09-07.
const THU = "2026-09-03";

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

describe("주 경계 — 월~일, 월요일 시작", () => {
  it("어느 요일이든 그 주의 월요일로 간다(일요일은 지난 월요일)", () => {
    expect(mondayOf("2026-08-31")).toBe("2026-08-31"); // 월
    expect(mondayOf(THU)).toBe("2026-08-31");
    expect(mondayOf("2026-09-06")).toBe("2026-08-31"); // 일
    expect(mondayOf("2026-09-07")).toBe("2026-09-07"); // 다음 월
    expect(mondayOf("2027-01-01")).toBe("2026-12-28"); // 연 경계
  });

  it("시작 주는 이번 주·다음 주 둘 — 완료 시점엔 지난주까지(일요일 밤 결제·월요일 복귀)", () => {
    expect(startWeekOptions(THU)).toEqual(["2026-08-31", "2026-09-07"]);
    expect(isAllowedStart("2026-09-07", THU)).toBe(true);
    expect(isAllowedStart("2026-08-24", THU)).toBe(true); // 지난주 — 복귀 유예
    expect(isAllowedStart("2026-09-14", THU)).toBe(false); // 두 주 뒤
    expect(isAllowedStart("2026-09-01", THU)).toBe(false); // 월요일이 아니다
  });

  it("기간 종료일은 마지막 주 일요일, 주 목록은 월요일들", () => {
    expect(promotionPeriod("2026-08-31", 1)).toEqual({
      startsAt: "2026-08-31",
      endsAt: "2026-09-06",
    });
    expect(promotionPeriod("2026-08-31", 4).endsAt).toBe("2026-09-27");
    expect(weeksOf(promotionPeriod("2026-08-31", 2))).toEqual(["2026-08-31", "2026-09-07"]);
  });

  it("이번 주 시작이면 오늘 포함 남은 날 수", () => {
    expect(daysLeftInWeek(THU)).toBe(4); // 목·금·토·일
    expect(daysLeftInWeek("2026-08-31")).toBe(7);
    expect(daysLeftInWeek("2026-09-06")).toBe(1);
  });

  it("날짜 모양 검사 — 결제 레코드에서 읽은 값이라 모양부터 본다", () => {
    expect(isIsoDate("2026-09-07")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("week1")).toBe(false);
    expect(isIsoDate("2026-9-7")).toBe(false);
  });
});

describe("정원 — 겹치는 주마다 센다, PAID만 넘어온다", () => {
  const paid = [
    span("SPECIAL", "2026-08-31", 1, "a"),
    span("SPECIAL", "2026-08-31", 4, "b"), // 08-31 ~ 09-27 네 주를 다 차지한다
    span("PLUS", "2026-09-07", 1, "c"),
  ];

  it("그 주에 팔린 건수 — 4주 상품은 네 주 모두에 잡힌다", () => {
    expect(soldInWeek("SPECIAL", "2026-08-31", paid)).toBe(2);
    expect(soldInWeek("SPECIAL", "2026-09-21", paid)).toBe(1);
    expect(soldInWeek("PLUS", "2026-08-31", paid)).toBe(0);
  });

  it("주별 요약은 누가 샀는지 싣지 않는다", () => {
    const sales = weeklySales(["2026-08-31", "2026-09-07"], paid);
    expect(sales).toEqual([
      { monday: "2026-08-31", sold: { SPECIAL: 2, PLUS: 0, BASIC: 0 } },
      { monday: "2026-09-07", sold: { SPECIAL: 1, PLUS: 1, BASIC: 0 } },
    ]);
  });

  it("정원(스페셜 3·플러스 2)에 닿으면 더 못 판다, 기본은 정원이 없다", () => {
    const full = [...paid, span("SPECIAL", "2026-08-31", 1, "d")];
    const week = promotionPeriod("2026-08-31", 1);
    expect(firstFullWeek("SPECIAL", week, weeklySales(weeksOf(week), paid))).toBeNull();
    expect(firstFullWeek("SPECIAL", week, weeklySales(weeksOf(week), full))).toBe("2026-08-31");
    const manyBasic = Array.from({ length: 50 }, (_, i) => span("BASIC", "2026-08-31", 1, `b${i}`));
    expect(firstFullWeek("BASIC", week, weeklySales(weeksOf(week), manyBasic))).toBeNull();
  });

  it("기간 중 첫 번째로 찬 주를 알려준다 — 2주 상품의 둘째 주가 찼으면 그 월요일", () => {
    const secondWeekFull = [
      ...paid,
      span("SPECIAL", "2026-09-07", 1, "e"),
      span("SPECIAL", "2026-09-07", 1, "f"),
    ];
    const period = promotionPeriod("2026-08-31", 2);
    // 09-07 주: b + e + f = 3 → 찼다
    expect(firstFullWeek("SPECIAL", period, weeklySales(weeksOf(period), secondWeekFull))).toBe(
      "2026-09-07",
    );
  });
});

describe("한 공고는 창 하나 — 이미 잡힌 창은 같은 등급으로 이어 사는 것만", () => {
  const mine = [span("BASIC", "2026-08-31", 2, "job-1")]; // 08-31 ~ 09-13

  it("오늘 이후로 끝나는 창이 있으면 그 등급·종료일, 끝난 창은 무시", () => {
    expect(pendingWindow("job-1", THU, mine)).toEqual({ tier: "BASIC", endsAt: "2026-09-13" });
    expect(pendingWindow("job-1", "2026-09-14", mine)).toBeNull();
    expect(pendingWindow("job-2", THU, mine)).toBeNull();
  });

  it("연장 = 같은 등급 + 창이 끝나는 바로 다음 월요일", () => {
    const window = { tier: "BASIC", endsAt: "2026-09-13" } as const;
    expect(isExtension(window, { tier: "BASIC", startsAt: "2026-09-14" })).toBe(true);
    expect(isExtension(window, { tier: "PLUS", startsAt: "2026-09-14" })).toBe(false);
    expect(isExtension(window, { tier: "BASIC", startsAt: "2026-09-07" })).toBe(false); // 겹침
    expect(isExtension(window, { tier: "BASIC", startsAt: "2026-09-21" })).toBe(false); // 한 주 비움
  });
});

describe("경합 — 적은 뒤 다시 읽어 먼저 적힌 행이 정원을 채웠으면 진 것", () => {
  const week = promotionPeriod("2026-08-31", 1);
  const earlier = [
    span("SPECIAL", "2026-08-31", 1, "a", "2026-09-03T01:00:00Z"),
    span("SPECIAL", "2026-08-31", 1, "b", "2026-09-03T01:00:01Z"),
  ];
  const ours = span("SPECIAL", "2026-08-31", 1, "me", "2026-09-03T01:00:05Z");

  it("먼저 적힌 행이 정원 미만이면 이겼다", () => {
    expect(lostCapacityRace("SPECIAL", week, ours, [...earlier, ours])).toBeNull();
  });

  it("먼저 적힌 행이 정원을 채웠으면 그 주에서 졌다 — 나중 행은 세지 않는다", () => {
    const third = span("SPECIAL", "2026-08-31", 1, "c", "2026-09-03T01:00:02Z");
    const later = span("SPECIAL", "2026-08-31", 1, "d", "2026-09-03T01:00:09Z");
    expect(lostCapacityRace("SPECIAL", week, ours, [...earlier, third, ours, later])).toBe(
      "2026-08-31",
    );
    // 같은 순간이면 결제번호 순 — 어느 쪽에서 봐도 한 명만 진다
    const same = span("SPECIAL", "2026-08-31", 1, "s", ours.createdAt);
    const tie = { ...same, paymentId: ours.paymentId < same.paymentId ? "zzz" : "aaa" };
    expect(lostCapacityRace("SPECIAL", week, ours, [...earlier, tie, ours])).toBe(
      tie.paymentId < ours.paymentId ? "2026-08-31" : null,
    );
  });

  it("정원 없는 등급은 경합이 없다", () => {
    const basics = Array.from({ length: 10 }, (_, i) =>
      span("BASIC", "2026-08-31", 1, `b${i}`, "2026-09-03T00:00:00Z"),
    );
    expect(lostCapacityRace("BASIC", week, ours, [...basics, ours])).toBeNull();
  });
});
