import { describe, expect, it } from "vitest";
import type { Job, JobChurchRef, JobDetail } from "@/types/domain";
import { jobShareCard, shareDescription } from "./seo";

// 공유 카드 재료는 OG 이미지가 그대로 그린다 — 여기서 고정해 두면 이미지 쪽이 조용히 어긋나지 않는다.
function detail(job: Partial<Job> = {}, church: Partial<JobChurchRef> = {}): JobDetail {
  return {
    job: {
      id: "job-001",
      title: "새소망교회에서 교육 전도사님을 모십니다",
      description: "",
      jobKind: ["MINISTRY"],
      position: ["EVANGELIST"],
      role: null,
      department: "CHILDREN",
      employmentType: "FULL_TIME",
      payMin: 220,
      payMax: null,
      payNote: null,
      payPeriod: "MONTH",
      workDays: "주일·수요",
      deadline: "2026-07-20",
      ...job,
    } as Job,
    church: null,
    churchRef: {
      id: null,
      name: "새소망교회",
      denomination: "HAPDONG",
      region: "GYEONGGI",
      city: "성남시 분당구",
      address: null,
      ...church,
    } as JobChurchRef,
    isPubliclyOpen: true,
    hiddenReason: null,
  } as JobDetail;
}

const cells = (d: JobDetail) =>
  jobShareCard(d).cells.map((c) => `${c.label}:${c.value}${c.muted ? "(흐림)" : ""}`);

describe("jobShareCard — 자리 한 줄 + 지역·사례비·마감 칸", () => {
  it("교회 · 교단 / 자리 / 칸 셋 — 값이 있으면 또렷하게", () => {
    const card = jobShareCard(detail());
    expect(card.context).toBe("새소망교회 · 예장합동");
    expect(card.role).toBe("전도사 · 유초등부 · 전임");
    expect(cells(detail())).toEqual(["지역:경기 성남시", "사례비:월 220만원", "마감:7/20"]);
  });

  it("값이 없는 칸은 협의·상시·미상으로 채우고 흐리게 — 없는 것도 자리는 지킨다", () => {
    const bare = detail(
      { payMin: null, payNote: "내규", deadline: null },
      { denomination: null, region: null, city: null },
    );
    expect(jobShareCard(bare).context).toBe("새소망교회");
    expect(cells(bare)).toEqual(["지역:미상(흐림)", "사례비:협의(흐림)", "마감:상시(흐림)"]);
  });

  it("지역은 시·군까지 — 구·동은 카드가 못 담는다", () => {
    expect(cells(detail({}, { city: "전주시 완산구" }))[0]).toBe("지역:경기 전주시");
    expect(cells(detail({}, { city: null }))[0]).toBe("지역:경기");
  });

  it("직분이 '기타'뿐이면 부서·고용으로, 그것도 없으면 공고 종류로 말한다 — 제목은 이미지에 안 들어간다", () => {
    expect(
      jobShareCard(
        detail({ position: ["ETC"], department: "WORSHIP", employmentType: "PART_TIME" }),
      ).role,
    ).toBe("찬양·예배 · 파트");
    expect(
      jobShareCard(detail({ position: ["ETC"], department: null, employmentType: null })).role,
    ).toBe("사역자");
    expect(
      jobShareCard(
        detail({
          jobKind: ["GENERAL"],
          position: [],
          role: null,
          department: null,
          employmentType: null,
        }),
      ).role,
    ).toBe("일반직");
  });

  it("일반직은 직무가 자리 줄이다", () => {
    expect(
      jobShareCard(
        detail({ jobKind: ["GENERAL"], position: [], role: "방송실 간사", department: null }),
      ).role,
    ).toBe("방송실 간사 · 전임");
  });

  it("연 단위 사례비는 원문 단위 그대로", () => {
    expect(cells(detail({ payMin: 4140, payPeriod: "YEAR" }))[1]).toBe("사례비:연 4,140만원");
  });
});

describe("shareDescription — 본문 첫 80자", () => {
  it("본문을 공백 정리해 80자에서 자르고 말줄임을 붙인다", () => {
    const long = "가".repeat(100);
    const out = shareDescription(detail({ description: `  ${long}\n\n둘째 줄` }));
    expect(out).toHaveLength(81);
    expect(out.endsWith("…")).toBe(true);
  });

  it("80자 이하면 그대로, 줄바꿈은 공백 하나로", () => {
    expect(shareDescription(detail({ description: "첫 줄\n둘째 줄" }))).toBe("첫 줄 둘째 줄");
  });

  it("본문이 비면 자리 요약으로 폴백 — 빈 카드를 보내지 않는다", () => {
    expect(shareDescription(detail({ description: "" }))).toBe(
      "새소망교회 · 예장합동 · 경기 성남시 분당구 · 전도사 · 유초등부 · 전임",
    );
  });
});
