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

/** 한 장 크기. 서버 상한과 같게 두고, 어긋나면 아래에서 **터뜨린다**(조용히 줄이지 않는다) */
const PAGE_SIZE = 1000;

/**
 * PostgREST 응답의 최소 모양. `count`가 필요하므로 호출부는 **`{ count: "exact" }`를 함께** 넘긴다 —
 * 총 수를 모르면 "짧은 장"이 데이터의 끝인지 서버 상한인지 구분할 방법이 없다.
 */
type Page = PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
  count: number | null;
}>;

/**
 * `page(from, to)`를 한 장씩 불러 다 이어 붙인다.
 *
 * ⚠️ **정렬에 유일한 마지막 키가 있어야 한다**(보통 `id`). `posted_at`만으로 정렬하면 같은 날짜
 *    행들의 순서가 요청마다 달라져 **장 경계에서 행이 중복되거나 빠진다** — 이것도 조용히 틀린다.
 *
 * ⚠️ **총 수와 어긋나면 던진다.** 짧은 장이 왔는데 아직 다 못 받았다면 서버 상한이 `PAGE_SIZE`보다
 *    낮아진 것이다. 그때 조용히 반환하면 처음 고치려던 그 버그로 되돌아간다 — 목록이 반만 나온 채
 *    아무도 모르는 상태보다, 화면이 에러를 내고 이 상수를 내리게 하는 편이 낫다.
 *
 * 행 타입 캐스트는 여기 한 줄뿐이다 — 호출부는 `fetchAllRows<CardRow>(...)`로 타입만 준다.
 */
export async function fetchAllRows<T>(
  label: string,
  page: (from: number, to: number) => Page,
): Promise<T[]> {
  const all: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error, count } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} 조회 실패: ${error.message}`);

    const rows = data ?? [];
    all.push(...rows);
    if (rows.length === PAGE_SIZE) continue;

    // 짧은 장 = 끝. 단 총 수와 맞는지 확인한다(안 맞으면 서버 상한이 더 낮다).
    if (count !== null && all.length < count) {
      throw new Error(
        `${label} 조회가 잘렸습니다 — ${all.length}/${count}행. 서버 행 상한이 ${PAGE_SIZE}행보다 ` +
          `낮습니다(마지막 장 ${rows.length}행). lib/queries/fetch-all.ts의 PAGE_SIZE를 그 이하로 내리세요.`,
      );
    }
    return all as T[];
  }
}
