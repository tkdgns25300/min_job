// 전체를 읽는 조회의 페이지 이어붙이기 — **`lib/queries/*` 내부 전용**.
//
// ⚠️⚠️ **PostgREST는 1,000행에서 자르고 에러를 주지 않는다**(실측 2026-08-22: 1,400행을 넣고
//    select하면 `count`는 1,400인데 받은 행은 1,000. `range(0, 4999)`로도 풀리지 않는다 —
//    서버측 `db-max-rows` 설정이라 클라이언트가 넘길 수 없다).
//    그래서 **테이블 전체를 훑는 조회는 반드시 이걸로 감싼다.** 안 감싸면 공고가 1,000건을 넘는
//    순간 목록·통계·sitemap이 **조용히** 1/3만 보여준다. 목표 규모가 3천 건이다.
//
// 대상은 **테이블 전체를 훑는 것**뿐이다. 교회 하나의 공고처럼 개체에 묶인 조회는 상한에 닿을 수
// 없어 감싸지 않는다(감싸면 왕복만 늘어난다).

const PAGE_SIZE = 1000;

/** PostgREST 응답의 최소 모양 — 빌더가 그대로 들어맞고, 행 타입은 호출부가 인자로 정한다 */
type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

/**
 * `page(from, to)`를 한 장씩 불러 다 이어 붙인다. 짧은 장이 오면 끝.
 *
 * ⚠️ **정렬에 유일한 마지막 키가 있어야 한다**(보통 `id`). `posted_at`만으로 정렬하면 같은 날짜
 *    행들의 순서가 요청마다 달라져 **장 경계에서 행이 중복되거나 빠진다** — 이것도 조용히 틀린다.
 *
 * 행 타입 캐스트는 여기 한 줄뿐이다 — 호출부는 `fetchAllRows<CardRow>(...)`로 타입만 준다.
 */
export async function fetchAllRows<T>(
  label: string,
  page: (from: number, to: number) => Page,
): Promise<T[]> {
  const all: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} 조회 실패: ${error.message}`);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all as T[];
  }
}
