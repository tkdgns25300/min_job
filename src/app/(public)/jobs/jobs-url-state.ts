import type { ReadonlyURLSearchParams } from "next/navigation";
import type { FilterDim, SortKey } from "@/types/domain";

// /jobs 목록의 검색·필터·정렬·페이지 상태 ↔ URL 쿼리 동기화 (공유·뒤로가기·딥링크·SEO).
// URL은 "초기 시드 + 상태 반영" 대상이지 단일 소스는 아니다(상태 → URL 단방향).
// URL을 단일 소스로 승격하는 건 DB 전환과 함께 별건으로 다룬다(ROADMAP).

// 다중선택 필터 축 — URL 파라미터 이름과 동일(getAll(dim))
export const MULTI_DIMS: FilterDim[] = [
  "denomination",
  "region",
  "position",
  "department",
  "employmentType",
  "qualification",
];

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_SORT: SortKey = "recent";
const SORT_KEYS: readonly SortKey[] = ["recent", "pay", "deadline"];

export interface JobsUrlState {
  q: string;
  selected: Record<FilterDim, Set<string>>;
  payMin: string;
  payMax: string;
  includeNego: boolean;
  housingOnly: boolean;
  sort: SortKey;
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
  for (const dim of MULTI_DIMS) selected[dim] = new Set(sp.getAll(dim));

  const sortRaw = sp.get("sort");
  const sort = SORT_KEYS.find((k) => k === sortRaw) ?? DEFAULT_SORT;

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
    sort,
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
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(state.pageSize));

  return params.toString();
}
