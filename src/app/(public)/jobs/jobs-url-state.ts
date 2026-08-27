import type { ReadonlyURLSearchParams } from "next/navigation";
import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  POSITIONS,
  QUALIFICATIONS,
  REGIONS,
} from "@/constants/domain";
import { keysOf } from "@/lib/domain-enum";
import type { FilterDim } from "@/types/domain";

// /jobs 목록의 검색·필터·페이지 상태 ↔ URL 쿼리 동기화 (공유·뒤로가기·딥링크·SEO).
// 정렬은 최신순 고정이라 URL에 싣지 않는다.
// URL은 "초기 시드 + 상태 반영" 대상이지 단일 소스는 아니다(상태 → URL 단방향).
// URL을 단일 소스로 승격하는 건 DB 전환과 함께 별건으로 다룬다(ROADMAP).

/**
 * 다중선택 필터 축 → 그 축의 **닫힌 라벨 맵**. URL 파라미터 이름은 축 이름과 같다(`getAll(dim)`).
 *
 * ⚠️ **맵을 함께 들고 있어야 URL 값을 검증할 수 있다.** 예전에는 축 이름만 배열로 갖고
 *    `new Set(sp.getAll(dim))`로 **아무 문자열이나 그대로 받았다** — `?region=MARS`나 없어진
 *    값(`?qualification=ANY`)이 들어오면 **0건이 뜨는데 눌린 칩은 없어** 왜 안 나오는지 알 수
 *    없는 막다른 화면이 됐다(실측 2026-08-27). 바로 아래 파서의 주석이 *"오래된 링크에도
 *    깨지지 않게 한다"* 고 약속하는데 이 축들만 그 약속 밖에 있었다.
 * ⚠️ 축이 늘면 **여기 한 줄만** 추가한다 — `job-filter.tsx`의 그룹 정의와 같은 짝이다.
 */
const DIM_OPTIONS: Record<FilterDim, Record<string, string>> = {
  denomination: DENOMINATIONS,
  region: REGIONS,
  position: POSITIONS,
  department: DEPARTMENTS,
  employmentType: EMPLOYMENT_TYPES,
  qualification: QUALIFICATIONS,
};

export const MULTI_DIMS: FilterDim[] = Object.keys(DIM_OPTIONS) as FilterDim[];

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

export interface JobsUrlState {
  q: string;
  selected: Record<FilterDim, Set<string>>;
  payMin: string;
  payMax: string;
  includeNego: boolean;
  housingOnly: boolean;
  page: number;
  pageSize: number;
}

export function emptySelected(): Record<FilterDim, Set<string>> {
  return Object.fromEntries(MULTI_DIMS.map((d) => [d, new Set<string>()])) as Record<
    FilterDim,
    Set<string>
  >;
}

// 사례비 입력값 정규화 — 양의 정수 문자열만 통과, 그 외(음수·소수·문자)는 "" (딥링크 방어)
function parseNumericField(raw: string | null): string {
  return raw && /^\d+$/.test(raw) ? raw : "";
}

// URL → 상태. 잘못된 값은 기본값으로 폴백해, 직접 편집·오래된 링크에도 깨지지 않게 한다.
export function parseJobsUrlState(sp: ReadonlyURLSearchParams | URLSearchParams): JobsUrlState {
  const selected = emptySelected();
  // 맵에 없는 값은 버린다(`keysOf`) — 남겨 두면 화면에 안 보이는 필터가 결과를 0건으로 만든다
  for (const dim of MULTI_DIMS) selected[dim] = new Set(keysOf(DIM_OPTIONS[dim], sp.getAll(dim)));

  const pageRaw = Number(sp.get("page"));
  const page = Number.isInteger(pageRaw) && pageRaw > 1 ? pageRaw : 1;

  const pageSizeRaw = Number(sp.get("pageSize"));
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeRaw)
    ? pageSizeRaw
    : DEFAULT_PAGE_SIZE;

  return {
    q: sp.get("q") ?? "",
    selected,
    payMin: parseNumericField(sp.get("payMin")),
    payMax: parseNumericField(sp.get("payMax")),
    includeNego: sp.get("includeNego") !== "0", // 기본 포함(true) — includeNego=0 일 때만 제외
    housingOnly: sp.get("housingOnly") === "1",
    page,
    pageSize,
  };
}

// 상태 → URL 쿼리 문자열. 기본값은 생략해 URL을 깨끗하게(공유 가능하게) 유지한다.
export function buildJobsQuery(state: JobsUrlState): string {
  const params = new URLSearchParams();

  const q = state.q.trim();
  if (q) params.set("q", q);

  for (const dim of MULTI_DIMS) {
    for (const value of state.selected[dim]) params.append(dim, value);
  }

  if (state.payMin) params.set("payMin", state.payMin);
  if (state.payMax) params.set("payMax", state.payMax);
  if (!state.includeNego) params.set("includeNego", "0");
  if (state.housingOnly) params.set("housingOnly", "1");
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(state.pageSize));

  return params.toString();
}
