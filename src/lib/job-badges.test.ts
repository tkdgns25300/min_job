import { describe, expect, it } from "vitest";
import { daysBetween, jobBadges } from "./job-badges";

const open = { isPubliclyOpen: true, housingProvided: null, deadline: null };
const kinds = (b: ReturnType<typeof jobBadges>) => b.map((x) => x.kind);

describe("daysBetween — ISO 날짜 차이", () => {
  it("같은 날 0, 다음 날 1, 거꾸로면 음수", () => {
    expect(daysBetween("2026-09-06", "2026-09-06")).toBe(0);
    expect(daysBetween("2026-09-06", "2026-09-07")).toBe(1);
    expect(daysBetween("2026-09-07", "2026-09-06")).toBe(-1);
  });
  it("월을 넘어도 맞는다 — 정오 기준이라 TZ·DST에 안 밀린다", () => {
    expect(daysBetween("2026-08-30", "2026-09-06")).toBe(7);
  });
  it("깨진 값은 NaN — 목록 전체가 죽지 않는다", () => {
    expect(daysBetween("어제", "2026-09-06")).toBeNaN();
  });
});

describe("jobBadges — 마감 임박 → 사택 순, 사실이 있을 때만", () => {
  const today = "2026-09-06";

  it("마감이 7일 안이면 D-n, 당일은 D-day", () => {
    expect(jobBadges({ ...open, deadline: "2026-09-11" }, today)).toEqual([
      { kind: "deadline", label: "D-5" },
    ]);
    expect(jobBadges({ ...open, deadline: today }, today)).toEqual([
      { kind: "deadline", label: "D-day" },
    ]);
  });

  it("경계 — 7일은 붙고 8일은 안 붙는다, 지난 마감도 안 붙는다", () => {
    expect(kinds(jobBadges({ ...open, deadline: "2026-09-13" }, today))).toEqual(["deadline"]);
    expect(kinds(jobBadges({ ...open, deadline: "2026-09-14" }, today))).toEqual([]);
    expect(kinds(jobBadges({ ...open, deadline: "2026-09-05" }, today))).toEqual([]);
  });

  it("사택은 true일 때만 — null(정보 없음)·false(명시적 미제공) 둘 다 배지 없음", () => {
    expect(kinds(jobBadges({ ...open, housingProvided: true }, today))).toEqual(["housing"]);
    expect(kinds(jobBadges({ ...open, housingProvided: false }, today))).toEqual([]);
    expect(kinds(jobBadges(open, today))).toEqual([]);
  });

  it("둘 다면 마감이 앞이다", () => {
    expect(
      kinds(jobBadges({ ...open, housingProvided: true, deadline: "2026-09-08" }, today)),
    ).toEqual(["deadline", "housing"]);
  });

  it("오늘을 모르면(서버 렌더) 날짜 배지만 비우고 사택은 그대로 — 마운트 뒤 D-n이 더해진다", () => {
    expect(
      kinds(jobBadges({ ...open, housingProvided: true, deadline: "2026-09-08" }, null)),
    ).toEqual(["housing"]);
  });

  it("공개에서 내려간 공고는 '마감' 하나뿐 — 사택·D-n을 덮는다", () => {
    expect(
      jobBadges({ isPubliclyOpen: false, housingProvided: true, deadline: "2026-09-08" }, today),
    ).toEqual([{ kind: "closed" }]);
  });
});
