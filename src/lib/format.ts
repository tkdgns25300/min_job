import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  POSITIONS,
  REGIONS,
  type Denomination,
  type Position,
} from "@/constants/domain";
import { NAVER_MAP_SEARCH_URL } from "@/constants/site";
import type { JobCard, JobChurchRef } from "@/types/domain";

// 도메인 값 표시 포매터

const KRW_PER_MAN = 10000; // 원 → 만원

// 월 사례비 표시: 범위/단일/비정형(내규 등)/없음 순
export function formatPay(min: number | null, max: number | null, note: string | null): string {
  if (min !== null && max !== null && min !== max) return `${min}~${max}만원`;
  if (min !== null) return `${min}만원`;
  if (note) return note;
  return "협의";
}

/**
 * 노출 상품 금액 표시 — `EXPOSURE_PRODUCTS`는 원 단위로 저장하고(결제·서버 검증이 쓴다)
 * 화면은 만원으로 읽는다. 요금 페이지·교회 대시보드·결제 화면이 **이 함수만** 쓰게 해서,
 * 가격을 상수 한 곳에서 바꾸면 광고 문구와 실제 청구액이 갈리지 않게 한다.
 * (사례비 `formatPay`와 달리 입력이 원 단위다 — 사례비는 애초에 만원으로 저장한다)
 * ⚠️ 만원 단위가 아닌 값을 넣으면 소수가 나온다(75000 → "7.5만원"). 현재 4개 상품가는 전부
 *    만원 배수라 문제없지만, 그런 가격을 쓰기로 하면 표기 단위부터 다시 정해야 한다.
 */
export function formatExposurePrice(won: number): string {
  return `${(won / KRW_PER_MAN).toLocaleString("ko-KR")}만원`;
}

/**
 * `timestamptz` 값을 **KST 날짜**로 — 검수 큐의 제출일·검수일 표시용.
 *
 * DB는 `timestamptz`에 **절대 시점**을 담는다(`+09:00`과 `Z`는 같은 순간이고 저장값이 동일하다).
 * 시간대는 **읽을 때 정해지므로** 그대로 그리면 UTC가 나온다 — 한국 자정~오전 9시 사이에
 * 만들어진 값은 **날짜가 하루 어긋난다.**
 *
 * `date` 컬럼(`postedAt`·`deadline`)에는 쓰지 않는다 — 시간대가 없어 변환할 것이 없다.
 * 그쪽의 KST 문제는 "오늘이 며칠인가"이고 `todayInSeoul()`(job-visibility)이 맡는다.
 */
export function formatKstDate(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null; // 깨진 값에 "Invalid Date"를 그리지 않는다
  // en-CA가 YYYY-MM-DD를 준다 — 수동 조립보다 짧고 자릿수 패딩 실수가 없다(todayInSeoul과 같은 관용구)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(at);
}

// 교회 위치: 지역(+시). 모르는 조각은 **생략**한다 — 방문자에게 "미상"은 정보가 아니라 잡음이고,
// 크롤 공고는 지역이 비어 있는 경우가 흔하다(DATA §3). 둘 다 없으면 "" → 호출부가 줄째로 걷어낸다.
export function churchLocation(church: Pick<JobChurchRef, "region" | "city">): string {
  return [church.region ? REGIONS[church.region] : null, church.city].filter(Boolean).join(" ");
}

// 직분 라벨 — 한 공고가 여러 직분을 담을 수 있다(DATA §3 판정 규칙).
// 목록·카드는 줄이 넘치므로 축약("부목사 외 2"), 상세는 full로 전부 보여준다.
// 빈 배열(일반직 공고)은 "" — 호출부의 filter(Boolean)가 걸러낸다.
export function positionLabel(positions: Position[], opts: { full?: boolean } = {}): string {
  const labels = positions.map((p) => POSITIONS[p]);
  if (labels.length <= 1 || opts.full) return labels.join(" · ");
  return `${labels[0]} 외 ${labels.length - 1}`;
}

// 직분 · 부서 · 고용형태 한 줄 (카드·로우 공통). 상세는 { full: true }로 직분 전부.
export function jobRoleLine(
  job: Pick<JobCard, "position" | "department" | "employmentType">,
  opts: { full?: boolean } = {},
): string {
  return [
    positionLabel(job.position, opts),
    job.department ? DEPARTMENTS[job.department] : null,
    EMPLOYMENT_TYPES[job.employmentType],
  ]
    .filter(Boolean)
    .join(" · ");
}

// 교단 라벨 — 미상이면 null이라 호출부의 `filter(Boolean)`·조건부 렌더가 조각째 걷어낸다.
// (공개 화면 규칙. "미상"을 쓰는 곳은 운영자 화면 한 곳뿐이라 거기서 인라인 처리한다)
export function denominationLabel(denomination: Denomination | null): string | null {
  return denomination ? DENOMINATIONS[denomination] : null;
}

type ChurchPlace = Pick<JobChurchRef, "name" | "region" | "city" | "address">;

/**
 * 상세 화면의 위치 한 줄 — 주소가 있으면 주소, 없으면 지역(+시). 아무것도 모르면 "".
 * ⚠️ `??`가 아니라 falsy 검사다 — ingest 구조화는 주소를 못 뽑으면 `""`를 주는데,
 *    `??`로 받으면 그 빈 문자열이 **알고 있는 지역·시까지 가려버린다**.
 */
export function churchPlaceLine(church: ChurchPlace): string {
  return church.address || churchLocation(church);
}

/**
 * 네이버 지도 검색 링크 — 위치 한 줄이 있으면 그걸로, 주소가 아닐 땐 교회명을 앞에 붙여 좁힌다.
 * **아무것도 모르면 null** — 교회명만으로 검색하면 동명 교회의 엉뚱한 위치를 짚는다.
 *
 * 공고 상세·교회 상세가 **같은 규칙을 써야** 해서 여기 둔다(전엔 각자 조립하다 한쪽만 고친 적 있다).
 * 실제 지도 임베드는 Phase 2(API 키) — 지금은 검색 링크까지다.
 */
export function naverMapUrl(church: ChurchPlace): string | null {
  const location = churchLocation(church);
  const query = church.address || (location && `${church.name} ${location}`);
  return query ? `${NAVER_MAP_SEARCH_URL}${encodeURIComponent(query)}` : null;
}

// 교회 요약 한 줄: 교단 · 지역. 아는 조각만 잇는다 — 전부 모르면 ""(호출부가 걷어낸다)
export function churchMetaLine(
  church: Pick<JobChurchRef, "denomination" | "region" | "city">,
): string {
  return [denominationLabel(church.denomination), churchLocation(church)]
    .filter(Boolean)
    .join(" · ");
}
