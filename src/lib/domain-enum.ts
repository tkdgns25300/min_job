// 닫힌 라벨 맵(`constants/domain`·`constants/review`)과 **DB 문자열** 사이의 변환.
//
// DB는 enum을 `text + CHECK`로 들고 있어 생성 타입이 전부 `string`이다(types/database.ts 머리말).
// 그래서 경계마다 두 방향이 필요하다 — 저장값을 도메인 키로 **좁히기**(`keyOf`·`keysOf`)와
// 키를 사람이 읽을 **라벨로 바꾸기**(`enumLabel`). 둘은 한 쌍이라 한 파일에 둔다.
//
// ⚠️ 이미 좁혀진 도메인 타입은 맵을 그냥 색인한다(`DEPARTMENTS[job.department]`).
//    여기 함수들은 **좁혀지지 않은 쪽 전용**이고, 그래서 `as keyof typeof` 캐스트가 화면마다
//    흩어지지 않는다(캐스트는 `keyOf` 안 한 곳에만 있다).

/** 맵에 있는 키만 통과 — DB CHECK가 이미 막지만, 타입을 좁히려면 런타임 확인이 필요하다 */
export function keyOf<K extends string>(map: Record<K, string>, value: string | null): K | null {
  return value !== null && value in map ? (value as K) : null;
}

/** 배열판. 맵에 없는 값은 **버린다** — 하나 때문에 목록 전체를 죽이는 것보다 낫다 */
export function keysOf<K extends string>(map: Record<K, string>, values: string[]): K[] {
  return values.filter((value): value is K => value in map);
}

/** 한글 라벨. 맵에 없는 값은 `null` — 호출부가 대체 문구를 고른다 */
export function enumLabel<K extends string>(
  map: Record<K, string>,
  value: string | null,
): string | null {
  const key = keyOf(map, value);
  return key === null ? null : map[key];
}
