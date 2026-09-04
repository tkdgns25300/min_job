import { describe, expect, it } from "vitest";
import type { FilterDim, JobCard } from "@/types/domain";
import { DIM_OPTIONS, emptySelected, MULTI_DIMS } from "./jobs-url-state";
import {
  facetCounts,
  filterAndSortJobs,
  splitListAds,
  type JobFilterCriteria,
} from "./filter-jobs";

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

  it("등급마다 정원까지만(스페셜 3 · 플러스 2) — 넘치는 광고는 일반 로우로 내려간다", () => {
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

function criteria(over: Partial<JobFilterCriteria> = {}): JobFilterCriteria {
  return {
    q: "",
    selected: emptySelected(),
    payMin: null,
    payMax: null,
    includeNego: true,
    housingOnly: false,
    ...over,
  };
}

/** 한 축만 고른 상태 */
function chose(dim: FilterDim, ...values: string[]): Record<FilterDim, Set<string>> {
  const selected = emptySelected();
  selected[dim] = new Set(values);
  return selected;
}

// 축마다 값이 갈리는 표본 — 서울 4 / 경기 2, 부서는 유초등부 2 · 중고등부 1 · 미상 3
const JOBS: JobCard[] = [
  card({ department: "CHILDREN", employmentType: "FULL_TIME" }),
  card({ department: "YOUTH", employmentType: "PART_TIME" }),
  card({ church: { ...card().church, region: "GYEONGGI" }, department: "CHILDREN" }),
  card({ church: { ...card().church, region: "GYEONGGI" } }),
  card({ position: ["ASSOCIATE_PASTOR", "EVANGELIST"] }),
  card({ church: { ...card().church, denomination: null } }),
];

describe("filterAndSortJobs — 미상은 그 축을 고른 순간 탈락한다", () => {
  it("부서를 고르면 부서 미상 공고가 빠진다", () => {
    expect(
      filterAndSortJobs(JOBS, criteria({ selected: chose("department", "CHILDREN") })),
    ).toHaveLength(2);
  });

  it("축 안은 OR, 축을 넘어가면 AND", () => {
    expect(
      filterAndSortJobs(JOBS, criteria({ selected: chose("department", "CHILDREN", "YOUTH") })),
    ).toHaveLength(3);

    const withRegion = chose("department", "CHILDREN", "YOUTH");
    withRegion.region = new Set(["SEOUL"]);
    expect(filterAndSortJobs(JOBS, criteria({ selected: withRegion }))).toHaveLength(2);
  });

  it("교단 미상 공고도 교단을 고르면 빠진다", () => {
    expect(
      filterAndSortJobs(JOBS, criteria({ selected: chose("denomination", "HAPDONG") })),
    ).toHaveLength(5);
  });

  it("직분은 배열이라 하나만 겹쳐도 통과한다", () => {
    expect(
      filterAndSortJobs(JOBS, criteria({ selected: chose("position", "ASSOCIATE_PASTOR") })),
    ).toHaveLength(1);
  });

  it("협의 공고(사례비 숫자 없음)를 넣을지는 includeNego가 정한다", () => {
    const paid = card({ payMin: 200 });
    expect(filterAndSortJobs([...JOBS, paid], criteria({ includeNego: false }))).toEqual([paid]);
  });

  it("연 단위 공고는 월로 환산해 비교한다", () => {
    const yearly = card({ payMin: 4140, payPeriod: "YEAR" }); // 월 345만원
    expect(filterAndSortJobs([yearly], criteria({ payMin: 300 }))).toEqual([yearly]);
    expect(filterAndSortJobs([yearly], criteria({ payMin: 400 }))).toEqual([]);
  });

  it("사택은 미상을 '없음'으로 보지 않는다 — '제공만 보기'가 true만 남긴다", () => {
    const yes = card({ housingProvided: true });
    const no = card({ housingProvided: false });
    expect(filterAndSortJobs([...JOBS, yes, no], criteria({ housingOnly: true }))).toEqual([yes]);
  });

  it("최신순 정렬", () => {
    const older = card({ postedAt: "2026-01-01" });
    const newer = card({ postedAt: "2026-12-31" });
    expect(ids(filterAndSortJobs([older, newer], criteria()))).toEqual([newer.id, older.id]);
  });

  // 자유검색이 훑는 12개 소스 중 제목·교회명만 다른 곳에서 걸리므로, 나머지를 여기서 고정한다.
  // 특히 `role`은 일반직의 직분 짝이라 빠지면 "행정간사"로 검색해도 그 공고가 안 나온다(그 주석의 계약).
  it("자유검색은 직무·지역·시·군·구·부서 라벨까지 훑는다", () => {
    const general = card({ position: [], role: "행정 간사" });
    expect(filterAndSortJobs([general], criteria({ q: "행정 간사" }))).toEqual([general]);

    const seoul = card({ department: "CHILDREN" }); // 기본 지역 = 서울
    expect(filterAndSortJobs([seoul], criteria({ q: "서울 유초등부" }))).toEqual([seoul]);

    const gangnam = card({ church: { ...card().church, city: "강남구" } });
    expect(filterAndSortJobs([gangnam], criteria({ q: "강남구" }))).toEqual([gangnam]);
  });
});

describe("facetCounts — 칩에 붙는 건수", () => {
  it("선택이 없으면 값마다 전체 건수, 미상은 어디에도 세지 않는다", () => {
    const counts = facetCounts(JOBS, criteria());
    expect(counts.department).toEqual({ CHILDREN: 2, YOUTH: 1 }); // 미상 3건은 어느 칩에도 없다
    expect(counts.region).toEqual({ SEOUL: 4, GYEONGGI: 2 });
    expect(counts.denomination).toEqual({ HAPDONG: 5 }); // 미상 1건은 없다
    expect(counts.employmentType).toEqual({ FULL_TIME: 1, PART_TIME: 1 });
    expect(counts.qualification).toEqual({}); // 표본 전체가 미상 — 칩이 다 0이라 비활성이 된다
  });

  it("자기 축의 선택은 무시한다 — 고른 뒤에도 형제 칩의 수가 그대로다", () => {
    const counts = facetCounts(JOBS, criteria({ selected: chose("department", "CHILDREN") }));
    expect(counts.department).toEqual({ CHILDREN: 2, YOUTH: 1 });
  });

  it("다른 축의 선택은 반영한다", () => {
    const counts = facetCounts(JOBS, criteria({ selected: chose("region", "GYEONGGI") }));
    expect(counts.department).toEqual({ CHILDREN: 1 }); // 중고등부는 0이라 키가 없다
  });

  it("직분이 여럿인 공고는 그 직분들에 모두 센다", () => {
    expect(
      facetCounts([card({ position: ["ASSOCIATE_PASTOR", "EVANGELIST"] })], criteria()).position,
    ).toEqual({ ASSOCIATE_PASTOR: 1, EVANGELIST: 1 });
  });

  it("검색어·사례비도 반영한다", () => {
    const wanted = card({ title: "찾는공고" });
    expect(facetCounts([...JOBS, wanted], criteria({ q: "찾는공고" })).region).toEqual({
      SEOUL: 1,
    });

    const paid = card({ payMin: 500, church: { ...card().church, region: "GYEONGGI" } });
    expect(facetCounts([...JOBS, paid], criteria({ includeNego: false })).region).toEqual({
      GYEONGGI: 1,
    });
  });

  it("두 축이 어긋난 공고는 어느 칩에도 세지 않는다", () => {
    // 서울·유초등부 공고 하나만 두고 경기·중고등부를 고르면, 어느 한 축을 풀어도 걸리지 않는다
    const selected = chose("region", "GYEONGGI");
    selected.department = new Set(["YOUTH"]);
    const counts = facetCounts([card({ department: "CHILDREN" })], criteria({ selected }));
    expect(counts.region).toEqual({});
    expect(counts.department).toEqual({});
  });

  /**
   * 화면이 약속하는 계약 — 칩에 적힌 수는 **그 칩을 눌렀을 때 나오는 결과 수**여야 한다.
   * 축을 한 번만 훑는 최적화(어긋난 축 개수 세기)가 이 등식을 깨지 않는지 여러 출발 상태로 확인한다.
   */
  it("칩의 수 = 그 칩을 눌렀을 때의 결과 수", () => {
    // 두 축을 함께 고른 상태를 반드시 넣는다 — "어긋난 축이 둘 이상이면 세지 않는다"가 여기서만 걸린다
    const twoAxes = chose("region", "SEOUL");
    twoAxes.department = new Set(["YOUTH"]);

    const bases: JobFilterCriteria[] = [
      criteria(),
      criteria({ selected: chose("region", "SEOUL") }),
      criteria({ selected: chose("department", "CHILDREN") }),
      criteria({ selected: twoAxes }),
      criteria({ selected: chose("position", "EVANGELIST") }),
      criteria({ q: "공고" }),
    ];

    for (const base of bases) {
      const counts = facetCounts(JOBS, base);
      for (const dim of MULTI_DIMS) {
        // 건수에 **있는** 값 = 적힌 수만큼 나온다
        for (const [value, count] of Object.entries(counts[dim])) {
          const clicked = { ...base, selected: { ...base.selected, [dim]: new Set([value]) } };
          expect(filterAndSortJobs(JOBS, clicked), `${dim}=${value}`).toHaveLength(count);
        }
        // 건수에 **없는** 값 = 진짜로 0건이다. 이쪽이 칩을 비활성으로 만드는 근거라 함께 묶어 둔다 —
        // 위 절반만 있으면 "0건인데 눌리는 칩"을 만드는 실수가 테스트를 통과한다.
        for (const value of Object.keys(DIM_OPTIONS[dim])) {
          if (value in counts[dim]) continue;
          const clicked = { ...base, selected: { ...base.selected, [dim]: new Set([value]) } };
          expect(filterAndSortJobs(JOBS, clicked), `${dim}=${value} (없는 값)`).toHaveLength(0);
        }
      }
    }
  });
});
