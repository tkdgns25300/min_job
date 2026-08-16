import { CHURCH_NAME_DENOMINATION_PREFIXES } from "@/constants/domain";
import type { Church, Job, JobChurchRef } from "@/types/domain";

// 공고 ↔ 교회 파생 로직 — 전부 **`jobs.church_id`가 null일 수 있어서** 생긴다(DATA §3).
// 교회 식별을 claim으로 미룬 결과, 공고는 소속 교회를 모른 채로 존재할 수 있다.
// mock→DB 전환 후에도 그대로 쓰는 순수 함수라 lib에 둔다(job-visibility.ts와 같은 자리).

/**
 * 공고에 붙여 보여줄 교회 정보 — 조인이 성립하지 않을 때가 정상이라 **없는 값을 지어내지 않는다**.
 * (이전엔 조인 실패 시 `"알 수 없는 교회"`·`ETC`·`SEOUL`로 메웠는데, 미상 교단이 `ETC`로,
 *  미상 지역이 서울로 둔갑해 필터·거점 판정을 오염시켰다.)
 *
 * **규칙 한 줄: `jobs`에 컬럼이 있으면 그 값이 표시 정본이고, 없는 것만 `churches`에서 온다.**
 * 이름·지역은 `jobs`(비정규화 — DATA §1 예외), 교단·시는 아직 `jobs`에 컬럼이 없어 교회에서 읽는다.
 *
 * ⚠️ **왜 교회를 정본으로 삼지 않는가** — 지역으로 거르는 코드가 조인 없이 돌아야 하기 때문이다.
 *    `getSimilarJobs`의 "같은 지역" 단계, 앞으로의 서버측 지역 필터·`jobs(region)` 인덱스가 전부
 *    `jobs.region`을 본다. 표시만 `churches.region`으로 바꾸면 **카드에 "서울"이라 적힌 공고가
 *    경기 공고의 "같은 지역" 슬롯에 들어가는** 어긋남이 생긴다(실제로 그렇게 만들었다가 되돌렸다).
 *
 * `jobs.church_name`은 **공고가 말한 그대로**라 claim 뒤에도 `churches.name`과 다를 수 있다(DATA §3).
 * 그건 어긋남이 아니라 의도다 — 공고 화면은 공고가 말한 이름을, 교회 상세는 인증된 이름을 보여준다.
 */
export function jobChurchRef(
  job: Pick<Job, "churchName" | "region">,
  church: Church | null,
): JobChurchRef {
  return {
    id: church?.id ?? null,
    name: job.churchName,
    denomination: church?.denomination ?? null,
    region: job.region,
    city: church?.city ?? null,
  };
}

// 교단 접두어 + 뒤따르는 갈래 괄호("대한예수교장로회(합동)")를 한 덩어리로 지운다.
// 긴 것부터 매칭 — "예장"이 "대한예수교장로회"보다 먼저 걸리면 안 된다(목록 순서와 무관하게 정렬로 강제).
// 이스케이프 — 라벨 맵에서 끌어오므로 괄호 붙은 교단이 추가되면 정규식 의미가 바뀐다.
const DENOMINATION_PREFIX = new RegExp(
  `^(?:${[...CHURCH_NAME_DENOMINATION_PREFIXES]
    .sort((a, b) => b.length - a.length)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(?:\\([^)]*\\))?`,
);

/** 교회명 동일성 비교용 정규화 — 표기 흔들림("은혜로 교회"·"대한예수교장로회(합동) 은혜로교회")을 흡수 */
export function normalizeChurchName(name: string): string {
  const compact = name.replace(/\s+/g, "");
  // ⚠️ 괄호는 **접두어 바로 뒤에서만** 벗긴다. 문자열 전체에서 지우면 "새길(중앙)교회"가
  //    "새길교회"가 되어 **무관한 새길교회와 합쳐진다** — 구분이 목적인 함수가 정반대로 동작한다.
  const stripped = compact.replace(DENOMINATION_PREFIX, "");
  // 이름이 통째로 교단 표기뿐이면(비정상 수집분) 빈 문자열이 되어 서로 다른 교회가 한 덩어리로
  // 뭉친다 — 구분이 목적인 함수가 정반대로 동작하므로 정규화 전 값으로 되돌린다.
  return stripped || compact;
}

/**
 * 교회 수 집계 키 — "청빙 중인 교회 N곳".
 * claim된 교회는 `church_id`가 정답이라 이름이 어떻게 흔들려도 한 곳으로 센다.
 * 미claim은 이름으로 묶되 **지역을 붙여** 전국에 흔한 이름(중앙교회)이 한 곳으로 뭉치는 걸 막는다.
 *
 * ⚠️ **근사값이고 오차는 양방향이다.**
 *  - 과소: 같은 지역 동명 교회("서울 중앙교회" 여럿)는 이름만으로 나눌 수 없어 하나로 합쳐진다.
 *  - 과대: 같은 교회인데 키가 갈리는 경우가 둘 있다 — ① 한 공고는 지역이 있고 다른 공고는
 *    미상이면 `이름@SEOUL` / `이름@`으로 갈린다(지역 미상 실측 19%) ② claim 직후 구 공고(미claim)와
 *    신 공고(claim)가 공존하면 `이름@지역` / `church_id`로 갈린다. 둘 다 검수·claim이 진행되며 줄어든다.
 */
export function churchIdentityKey(job: Pick<Job, "churchId" | "churchName" | "region">): string {
  if (job.churchId) return job.churchId;
  return `${normalizeChurchName(job.churchName)}@${job.region ?? ""}`;
}
