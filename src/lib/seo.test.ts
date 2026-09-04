import { describe, expect, it } from "vitest";
import type { Job, JobChurchRef, JobDetail } from "@/types/domain";
import { jobShareLines } from "./seo";

// 공유 카드 세 줄은 **이미지와 `og:description`이 함께** 쓴다 — 한쪽만 고쳐 둘이 다른 말을 하는 것을 막는다.
function detail(job: Partial<Job> = {}, church: Partial<JobChurchRef> = {}): JobDetail {
  return {
    job: {
      id: "job-001",
      title: "새소망교회에서 교육 전도사님을 모십니다",
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
      city: "성남시",
      address: null,
      ...church,
    } as JobChurchRef,
    isPubliclyOpen: true,
    hiddenReason: null,
  } as JobDetail;
}

describe("jobShareLines — 공유 카드 세 줄", () => {
  it("맥락·자리·사실 세 줄", () => {
    expect(jobShareLines(detail())).toEqual({
      context: "새소망교회 · 예장합동 · 경기 성남시",
      headline: "전도사 · 유초등부 · 전임",
      facts: "월 220만원 · 주일·수요 출근 · 마감 7/20",
    });
  });

  it("직분이 '기타'뿐이면 교회가 쓴 제목을 쓴다 — 자리 줄이 부서만 남아 무엇을 뽑는지 안 보인다", () => {
    const etc = detail({
      title: "성민교회 3부 찬양대 오르간 반주자 모십니다",
      position: ["ETC"],
      department: "WORSHIP",
      employmentType: null,
    });
    expect(jobShareLines(etc).headline).toBe("성민교회 3부 찬양대 오르간 반주자 모십니다");
  });

  it("일반직은 직분 자리를 직무가 채운다", () => {
    const general = detail({ position: [], role: "방송실 간사", department: null });
    expect(jobShareLines(general).headline).toBe("방송실 간사 · 전임");
  });

  it("긴 출근 문구는 뺀다 — 썸네일이 못 담는다", () => {
    const wordy = detail({ workDays: "예배 전(9시 30분 부터), 예배 후(1시 까지)" });
    expect(jobShareLines(wordy).facts).toBe("월 220만원 · 마감 7/20");
  });

  it("금액이 없으면 '사례비 협의', 마감일이 없으면 '상시모집'", () => {
    const nego = detail({ payMin: null, payNote: "교회 내규에 따름", deadline: null });
    expect(jobShareLines(nego).facts).toBe("사례비 협의 · 주일·수요 출근 · 상시모집");
  });

  it("연 단위 공고는 원문 단위 그대로 — 월로 환산하지 않는다", () => {
    expect(jobShareLines(detail({ payMin: 4140, payPeriod: "YEAR" })).facts).toContain(
      "연 4,140만원",
    );
  });

  it("교단·지역이 미상이면 그 조각만 빠진다(미claim 공고)", () => {
    const bare = jobShareLines(detail({}, { denomination: null, region: null, city: null }));
    expect(bare.context).toBe("새소망교회");
  });
});
