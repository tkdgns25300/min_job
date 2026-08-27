import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  PAY_PERIODS,
  POSITIONS,
  REGIONS,
  type Denomination,
  type JobKind,
  type Position,
} from "@/constants/domain";
import { NAVER_MAP_SEARCH_URL } from "@/constants/site";
import type { Job, JobCard, JobChurchRef } from "@/types/domain";

// 도메인 값 표시 포매터

const KRW_PER_MAN = 10000; // 원 → 만원
const DAY_MS = 86_400_000;
const WEEK_DAYS = 7; // 여기부터는 "N일 전"이 날짜보다 읽기 어렵다(7일째가 곧 날짜 표기)

// 천 단위 구분 — 연 금액은 네 자리(4,140만원)라 없으면 읽히지 않는다.
const comma = (value: number) => value.toLocaleString("ko-KR");

/**
 * 사례비·급여 표시: 범위 / 단일 / 비정형(내규 등) / 없음 순.
 *
 * **접두는 공고에 적힌 단위 그대로**("월 280만원"·"연 4,140만원"). 값이 단위를 드는 이유:
 * 목록 카드에는 라벨이 없어서, 값에 단위가 없으면 `4,140만원`이 월인지 연인지 알 수 없다.
 * 월로 환산해 보여주지 않는 근거는 `PAY_PERIODS` 주석 참조(없는 숫자를 만들게 된다).
 */
export function formatPay(
  job: Pick<JobCard, "payMin" | "payMax" | "payNote" | "payPeriod">,
): string {
  const { payMin: min, payMax: max, payNote: note, payPeriod: period } = job;
  const unit = PAY_PERIODS[period];
  if (min !== null && max !== null && min !== max) return `${unit} ${comma(min)}~${comma(max)}만원`;
  if (min !== null) return `${unit} ${comma(min)}만원`;
  // ⚠️ 최대만 있는 경우 — 없으면 이 줄이 "협의"로 떨어져 **적은 금액이 화면에서 사라진다**
  //    (필터는 `payMax ?? payMin`을 보므로 걸리기는 한다 · filter-jobs.ts). 크롤은 단일 금액을
  //    `pay_min`에 넣어 여기 오지 않지만, 등록 폼은 최대 칸만 채울 수 있다.
  if (max !== null) return `${unit} ${comma(max)}만원 이하`;
  // 비정형 표현엔 단위를 붙이지 않는다 — "월 교회 내규에 따름"은 원문에 없는 말이 된다.
  if (note) return note;
  return "협의";
}

/**
 * 사택 표기 — boolean 3상태와 비정형 표현을 한 문장으로. `payNote`가 `payMin`의 짝인 것과 같은 관계.
 *
 * `null`(정보 없음/협의)과 `false`(명시적 미제공)를 구분한다(DATA §3): 정보가 없는데 "미제공"이라
 * 쓰면 공고가 하지 않은 말을 우리가 하는 것이 된다. **둘 다 비면 `null`을 돌려 호출부가 줄째 생략**한다.
 */
export function housingLabel(job: Pick<Job, "housingProvided" | "housingNote">): string | null {
  const { housingProvided: provided, housingNote: note } = job;
  if (provided === null) return note;
  return [provided ? "제공" : "미제공", note].filter(Boolean).join(" · ");
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
  return `${comma(won / KRW_PER_MAN)}만원`;
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

/**
 * 운영 화면의 시각 표시 — `오늘 06:02` · `어제 18:04` · `3일 전 17:01`.
 *
 * 상대 시간("15시간 전")이 아닌 이유는 **날짜와 시각이 사람이 한눈에 읽는 형태**여서다 — "어제 18:04"는
 * 언제였는지를 그대로 말하지만 "20시간 전"은 머릿속에서 다시 계산해야 한다.
 * ⚠️ **"오래됐나"를 여기서 판단하지 않는다** — 그건 경과 시간으로 재고(운영자 홈의 `CRAWL_OVERDUE_HOURS`)
 *    이 함수는 표기만 맡는다. 한때 이 둘이 같은 규칙이었다가 갈렸다(2026-08-25).
 * 이레째부터, 그리고 미래 시각이면 날짜를 그대로 쓴다 — "-3일 전"을 만들지 않는다.
 *
 * `todayKst`를 **인자로 받는다**: "오늘이 며칠인가"의 단일 소스는 `todayInSeoul()`이고(job-visibility),
 * 여기서 다시 구하면 사본이 된다. 순수 함수라 호출부가 캐시 안팎을 스스로 정한다.
 */
export function formatKstDayTime(iso: string, todayKst: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
  const day = formatKstDate(iso);
  if (!day) return "";
  // 날짜 문자열끼리의 뺄셈 — 둘 다 KST 자정 기준이라 시간대 계산이 끼어들지 않는다
  const days = Math.round(
    (Date.parse(`${todayKst}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY_MS,
  );
  if (days === 0) return `오늘 ${time}`;
  if (days === 1) return `어제 ${time}`;
  if (days > 1 && days < WEEK_DAYS) return `${days}일 전 ${time}`;
  return `${day} ${time}`;
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

/**
 * 자리 한 줄: 직분 · 직무 · 부서 · 고용형태 (카드·로우·운영자 테이블 공통).
 * 상세는 `{ full: true }`로 직분을 전부 펼친다.
 *
 * **직분과 직무는 같은 자리에 온다** — 사역직은 `position`, 일반직은 `role`이 채우고
 * 둘이 섞인 공고(한 글에 부목사 + 관리직원)는 둘 다 나온다. 없는 쪽은 조각째 빠진다.
 */
export function jobRoleLine(
  job: Pick<JobCard, "position" | "role" | "department" | "employmentType">,
  opts: { full?: boolean } = {},
): string {
  return [
    positionLabel(job.position, opts),
    job.role,
    job.department ? DEPARTMENTS[job.department] : null,
    job.employmentType ? EMPLOYMENT_TYPES[job.employmentType] : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * 금액 항목 이름 — 사역직은 "사례비", 일반직은 "급여"(DATA §3 `pay_min`).
 * 혼합 공고는 "사례비" — 주력이 사역직이고, 라벨을 둘 다 붙이면 길어진다.
 */
export function payLabel(jobKind: JobKind[]): string {
  return jobKind.length === 1 && jobKind[0] === "GENERAL" ? "급여" : "사례비";
}

// 교단 라벨 — 미상이면 null이라 호출부의 `filter(Boolean)`·조건부 렌더가 조각째 걷어낸다.
// (공개 화면 규칙. "미상"을 쓰는 곳은 운영자 화면 한 곳뿐이라 거기서 인라인 처리한다)
export function denominationLabel(denomination: Denomination | null): string | null {
  return denomination ? DENOMINATIONS[denomination] : null;
}

type ChurchPlace = Pick<JobChurchRef, "name" | "region" | "city" | "address">;

/**
 * 상세 화면의 위치 한 줄 — 지역·시·군·구에 **상세 주소를 이어 붙인다**("서울 강남구 테헤란로 1").
 * 아는 조각만 잇고, 아무것도 모르면 ""(호출부가 줄째로 걷어낸다).
 *
 * ⚠️ **`address`는 나머지 조각이지 전체 주소가 아니다**(2026-08-26 정정). 실제로 들어 있는 값은
 *    `청수12로 29`·`신정동 311-11`처럼 **지역·시를 뺀 상세 주소**다(크롤 실데이터 · 신청 폼도
 *    그렇게 받는다). 예전엔 주소가 있으면 그것만 써서 위치 줄이 `청수12로 29`로 끝났다.
 * ⚠️ **지역·시가 헤더(`churchMetaLine`)에 이미 있어 한 화면에 두 번 나온다** — 그래도 잇는다.
 *    ① 위치 칸은 그것만 읽어도 주소여야 하고 ② **바로 밑 지도 링크가 검색하는 문자열과 같아야**
 *    한다(읽은 것과 검색되는 것이 다르면 누른 사람이 어리둥절해진다).
 * ⚠️ `filter(Boolean)`이라 `null`과 `""`를 함께 걷어낸다 — 구조화가 주소를 못 뽑으면 `""`를 주는데,
 *    그게 조각으로 끼면 공백이 두 칸이 된다.
 */
export function churchPlaceLine(church: ChurchPlace): string {
  return [churchLocation(church), church.address].filter(Boolean).join(" ");
}

/**
 * 네이버 지도 검색 링크 — 위치 한 줄로 검색하되, **상세 주소가 없으면 교회명을 앞에 붙여** 좁힌다
 * (지역·시만으로는 그 동네 전체가 나온다). **아무것도 모르면 null** — 교회명만으로 검색하면
 * 동명 교회의 엉뚱한 위치를 짚는다.
 *
 * 공고 상세·교회 상세가 **같은 규칙을 써야** 해서 여기 둔다(전엔 각자 조립하다 한쪽만 고친 적 있다).
 * 실제 지도 임베드는 Phase 2(API 키) — 지금은 검색 링크까지다.
 */
export function naverMapUrl(church: ChurchPlace): string | null {
  const place = churchPlaceLine(church);
  if (!place) return null;
  const query = church.address ? place : `${church.name} ${place}`;
  return `${NAVER_MAP_SEARCH_URL}${encodeURIComponent(query)}`;
}

// 교회 요약 한 줄: 교단 · 지역. 아는 조각만 잇는다 — 전부 모르면 ""(호출부가 걷어낸다)
export function churchMetaLine(
  church: Pick<JobChurchRef, "denomination" | "region" | "city">,
): string {
  return [denominationLabel(church.denomination), churchLocation(church)]
    .filter(Boolean)
    .join(" · ");
}
