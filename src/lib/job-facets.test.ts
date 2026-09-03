import { describe, expect, it } from "vitest";
import type { JobCard } from "@/types/domain";
import {
  FACET_AXES,
  facetGroups,
  facetHeading,
  facetKeyFromSlug,
  facetKeys,
  facetPath,
  facetSlug,
  facetsOfJob,
  filterByFacet,
  siblingFacets,
} from "./job-facets";

let seq = 0;
function card(over: Partial<JobCard> = {}): JobCard {
  seq += 1;
  return {
    id: `job-${String(seq).padStart(3, "0")}`,
    isPubliclyOpen: true,
    title: `공고${seq}`,
    church: { name: `교회${seq}`, denomination: "HAPDONG", region: "GYEONGGI", city: "수원시" },
    position: ["EVANGELIST"],
    role: null,
    department: "CHILDREN",
    employmentType: "FULL_TIME",
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

describe("주소 — 키와 URL 조각이 왕복한다", () => {
  it("대문자 키가 소문자 kebab이 된다", () => {
    expect(facetSlug("GYEONGGI")).toBe("gyeonggi");
    expect(facetSlug("ASSOCIATE_PASTOR")).toBe("associate-pastor");
    expect(facetPath("position", "ASSOCIATE_PASTOR")).toBe("/jobs/position/associate-pastor");
  });

  it("모든 축의 모든 값이 왕복한다", () => {
    for (const axis of FACET_AXES) {
      for (const key of facetKeys(axis)) {
        expect(facetKeyFromSlug(axis, facetSlug(key))).toBe(key);
      }
    }
  });

  it("없는 조각·오타는 null이다 — 호출부가 404를 낸다", () => {
    expect(facetKeyFromSlug("region", "mars")).toBeNull();
    expect(facetKeyFromSlug("region", "GYEONGGI")).toBeNull(); // 대문자 주소는 우리 주소가 아니다
  });
});

describe('랜딩을 만들지 않는 값 — "기타"는 검색어가 아니다', () => {
  it("직분 기타·부서 행정·기타는 목록에 없고 주소도 열리지 않는다", () => {
    expect(facetKeys("position")).not.toContain("ETC");
    expect(facetKeys("department")).not.toContain("ETC");
    expect(facetKeys("department")).not.toContain("ADMIN");
    expect(facetKeyFromSlug("position", "etc")).toBeNull();
    expect(facetKeyFromSlug("department", "admin")).toBeNull();
  });

  it("지역은 전부 만든다 — 해외까지", () => {
    expect(facetKeys("region")).toHaveLength(18);
    expect(facetKeys("region")).toContain("OVERSEAS");
  });
});

describe("제목 — 직분은 그 자체가 사람이라 '사역자'를 붙이지 않는다", () => {
  it("축마다 다른 문구", () => {
    expect(facetHeading("region", "GYEONGGI")).toBe("경기 사역자 청빙 공고");
    expect(facetHeading("position", "EVANGELIST")).toBe("전도사 청빙 공고");
    expect(facetHeading("department", "CHILDREN")).toBe("유초등부 사역자 청빙 공고");
  });
});

describe("담기는 공고 — 사역직만, 직분은 포함 판정", () => {
  it("일반직 공고는 빠진다 — 직분이 비어 있는 것으로 가른다", () => {
    const general = card({ position: [], role: "행정 간사" });
    expect(filterByFacet([general], "region", "GYEONGGI")).toEqual([]);
  });

  it("혼합 공고는 들어간다 — 사역직 자리도 뽑기 때문", () => {
    const mixed = card({ position: ["ASSOCIATE_PASTOR"], role: "미디어 담당" });
    expect(filterByFacet([mixed], "region", "GYEONGGI")).toHaveLength(1);
  });

  it("직분이 여럿인 공고는 그 직분 랜딩마다 등장한다", () => {
    const many = card({ position: ["ASSOCIATE_PASTOR", "EVANGELIST", "LICENSED_MINISTER"] });
    expect(filterByFacet([many], "position", "EVANGELIST")).toHaveLength(1);
    expect(filterByFacet([many], "position", "LICENSED_MINISTER")).toHaveLength(1);
    expect(filterByFacet([many], "position", "SENIOR_PASTOR")).toEqual([]);
  });

  it("지역·부서는 값이 하나라 정확히 일치할 때만", () => {
    const seoul = card({ church: { ...card().church, region: "SEOUL" } });
    expect(filterByFacet([seoul], "region", "GYEONGGI")).toEqual([]);
    expect(filterByFacet([card({ department: null })], "department", "CHILDREN")).toEqual([]);
  });
});

describe("분포 블록 — 자기 축은 빼고, 랜딩 있는 값만 링크", () => {
  const jobs = [
    card({ church: { ...card().church, region: "GYEONGGI", city: "수원시" } }),
    card({ church: { ...card().church, region: "GYEONGGI", city: "수원시" } }),
    card({ church: { ...card().church, region: "GYEONGGI", city: "성남시" } }),
  ];

  it("지역 랜딩에는 지역 분포가 없다 — 상수라 정보가 아니다", () => {
    const labels = facetGroups(jobs, "region").map((g) => g.label);
    expect(labels).not.toContain("지역");
    expect(labels).toContain("주요 지역"); // 시·군은 남는다
  });

  it("직분 랜딩에는 지역 분포가 생긴다", () => {
    expect(facetGroups(jobs, "position").map((g) => g.label)).toContain("지역");
  });

  it("많은 순으로 세고, 미상은 항목이 되지 않는다", () => {
    const cities = facetGroups(jobs, "region").find((g) => g.label === "주요 지역");
    expect(cities?.items.map((i) => [i.label, i.count])).toEqual([
      ["수원시", 2],
      ["성남시", 1],
    ]);
    const unknown = [card({ department: null }), card({ department: null })];
    const dept = facetGroups(unknown, "region").find((g) => g.label === "부서");
    expect(dept).toBeUndefined(); // 항목이 하나도 없으면 블록째 사라진다
  });

  it("교단은 랜딩이 없어 링크가 걸리지 않는다", () => {
    const denom = facetGroups(jobs, "region").find((g) => g.label === "교단");
    expect(denom?.items[0]?.href).toBeNull();
    const cities = facetGroups(jobs, "region").find((g) => g.label === "주요 지역");
    expect(cities?.items[0]?.href).toBeNull(); // 시·군도 자유 텍스트라 링크 없음
  });

  it("랜딩이 있는 값만 링크 — 제외된 '기타' 직분은 세어도 링크가 없다", () => {
    const etc = [card({ position: ["ETC"] }), card({ position: ["EVANGELIST"] })];
    const items = facetGroups(etc, "region").find((g) => g.label === "직분")?.items ?? [];
    expect(items.find((i) => i.label === "기타")?.href).toBeNull();
    expect(items.find((i) => i.label === "전도사")?.href).toBe("/jobs/position/evangelist");
  });
});

describe('상세의 "같은 조건 모아보기" — 필터와 같은 술어', () => {
  it("사역직 공고는 지역·직분들·부서 링크를 받는다", () => {
    const links = facetsOfJob({
      region: "GYEONGGI",
      position: ["ASSOCIATE_PASTOR", "EVANGELIST"],
      department: "CHILDREN",
    });
    expect(links.map((l) => l.href)).toEqual([
      "/jobs/region/gyeonggi",
      "/jobs/position/associate-pastor",
      "/jobs/position/evangelist",
      "/jobs/department/children",
    ]);
  });

  it("일반직 공고는 **아무 링크도 받지 않는다** — 그 랜딩이 이 공고를 담지 않기 때문", () => {
    expect(facetsOfJob({ region: "GYEONGGI", position: [], department: "ADMIN" })).toEqual([]);
  });

  it("랜딩이 없는 값은 건너뛴다 — 부서 행정·직분 기타", () => {
    const links = facetsOfJob({
      region: "GYEONGGI",
      position: ["ETC"],
      department: "ADMIN",
    });
    expect(links.map((l) => l.href)).toEqual(["/jobs/region/gyeonggi"]);
  });
});

describe("형제 링크", () => {
  it("자기 자신은 빠진다", () => {
    const siblings = siblingFacets("region", "GYEONGGI");
    expect(siblings).toHaveLength(17);
    expect(siblings.map((s) => s.href)).not.toContain("/jobs/region/gyeonggi");
  });
});
