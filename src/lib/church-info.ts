import { CHURCH_CHANNELS, REGIONS, type ChurchChannel, type Region } from "@/constants/domain";
import { keyOf } from "@/lib/domain-enum";
import { MAX_LENGTHS } from "@/lib/church-verification";
import type { Church } from "@/types/domain";
import type { TablesUpdate } from "@/types/database";

// 인증 교회가 스스로 고치는 정보의 규칙(순수) — **폼과 Server Action이 같은 답을 쓴다.**
// 화면은 왕복을 아끼려고 미리 돌리고, 신뢰 경계는 액션이라 서버가 같은 검증을 다시 한다.
//
// ⚠️ **길이 상한은 `church-verification`에서 가져온다.** 같은 컬럼(`city`·`address`·연락처)을
//    인증 신청 화면이 먼저 받고 있어서, 여기서 새로 선언하면 한 컬럼에 상한이 둘이 되어 갈린다.
//    새로 정하는 것은 이 파일에 없던 것(`url`·창립연도 범위)뿐이다.
// ⚠️ **교회명·교단은 여기서 다루지 않는다.** 인증으로 확정된 값이라 미검증 입력이 덮어쓰면 안 된다
//    (공고 폼이 교회 값을 읽기만 하는 것과 같은 이유 · `jobs/actions.ts` 머리말).
// ⛔ **공고에는 전파하지 않는다.** 공고는 등록 시점의 교회 값을 복사해 갖고 있고 그것이 정본이다
//    (SPEC `/mypage/church/info` · DATA §1 예외 ③). 교회 주소와 공고의 사역지는 **다를 수 있고**
//    (지성전·교육관·개척지), `/admin/jobs/[id]`가 공고별로 고칠 수 있게 열어 둔 값이라 전파하면
//    운영자가 손본 것을 덮는다.

/** 폼이 들고 있는 값 — **입력 그대로**다(창립연도가 문자열인 이유) */
export interface ChurchInfoDraft {
  region: Region | null;
  city: string;
  address: string;
  foundedYear: string;
  contactTel: string;
  contactEmail: string;
  /** 채널 주소 — 비운 채널은 저장할 때 행을 지운다 */
  links: Partial<Record<ChurchChannel, string>>;
}

/**
 * 검증에 걸린 칸. 채널은 **키가 갈린다**(`link:YOUTUBE`) — 여섯 칸 중 어디가 틀렸는지
 * 그 자리에 말해야 하고, 하나로 묶으면 어느 줄을 고쳐야 할지 알 수 없다.
 */
export type InfoField =
  | "region"
  | "city"
  | "address"
  | "foundedYear"
  | "contactTel"
  | "contactEmail"
  | `link:${ChurchChannel}`;

export type InfoErrors = Partial<Record<InfoField, string>>;

/** 채널 주소 상한 — 이 파일에서 처음 정하는 값(`church-verification`에 없다) */
export const MAX_CHANNEL_URL = 300;

/**
 * 창립연도 범위. 컬럼이 `integer`라 막지 않으면 Postgres가 거부하면서
 * 화면엔 "저장하지 못했어요"만 뜬다(사례비 `MAX_PAY`와 같은 함정).
 */
const FOUNDED_YEAR_MIN = 1800;

/** 올해 — cached scope에서 불리지 않는다(폼은 client, 액션은 uncached · `job-draft`와 같은 판단) */
function currentYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()).slice(0, 4),
  );
}

const trimmed = (value: string) => value.trim();
const blankToNull = (value: string): string | null => trimmed(value) || null;
const tooLong = (value: string, limit: number) => trimmed(value).length > limit;

/**
 * 채널 주소 정규화 — 스킴이 없으면 `https://`를 붙인다. 교회는 `andongtaehwa.org`처럼
 * 주소만 적는데, 그대로 저장하면 공개 페이지에서 **상대 경로 링크가 되어 깨진다**.
 *
 * 🔴 **스킴을 확인하는 것이 핵심이다.** `javascript:alert(1)`은 스킴이 **있어서** 위 부착을
 *    비껴가고 `new URL()`도 통과한다. 그 값이 교회 상세의 `href`로 그대로 나가면
 *    (`components/church/church-channels.tsx` — 컬럼에 CHECK도 없다) 누른 사람 브라우저에서
 *    실행된다. `data:`·`mailto:`·`tel:`도 같은 문으로 들어온다.
 *    그래서 **`http`/`https`만** 통과시킨다.
 * ⚠️ **호스트 모양도 본다.** `https://foo`(점 없음)·`https://.com`·`https://a.`은 파싱만 보면
 *    통과하는데 전부 죽은 링크다 — 교회는 "형식이 맞다"는 답을 듣고 저장하게 된다.
 *    점으로 나뉜 조각이 모두 비어 있지 않아야 한다.
 * ⚠️ **자격증명은 지운다.** `https://naver.com@evil.com/`처럼 아는 도메인을 앞에 세워 사람을
 *    속이는 모양이 되고, 교회가 실수로 붙여 넣은 비밀번호가 공개 페이지에 박힐 수도 있다.
 */
const HOSTNAME = /^[^.]+(\.[^.]+)+$/;

function normalizeChannelUrl(raw: string): string | null {
  const value = trimmed(raw);
  if (!value) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!HOSTNAME.test(url.hostname)) return null;
  url.username = "";
  url.password = "";
  return url.toString();
}

/**
 * 저장 전 검증 — **`churches`의 CHECK와 폼의 필수 표시에 맞춘다.**
 *
 * ⚠️ **지역·시·군·구를 필수로 둔다.** 둘 다 인증 신청에서 이미 필수로 받는 값이라
 *    (`churchDraftErrors`) 인증된 교회는 전부 갖고 있다 — 여기서 선택으로 두면 **한 화면이
 *    요구한 값을 다른 화면이 지울 수 있다**. 게다가 이 둘은 공고를 만들 때 복사되므로, 비면
 *    그 공고가 지역 필터에서 탈락한다(DATA: 비면 사실상 안 보이는 공고).
 * ⚠️ 연락처 형식은 **느슨하게** 본다 — 사무용 전화는 `054)000-0000`·내선 표기가 실재하고
 *    엄격한 정규식은 진짜 교회를 막는다(`applicantDraftErrors`와 같은 판단).
 */
export function infoErrors(draft: ChurchInfoDraft): InfoErrors {
  const errors: InfoErrors = {};

  // 화면은 닫힌 목록에서 고르지만 액션은 직접 호출될 수 있다 — 키로 확인한다(`churches_region_check`)
  if (draft.region === null || keyOf(REGIONS, draft.region) === null)
    errors.region = "지역을 골라 주세요.";

  if (blankToNull(draft.city) === null) errors.city = "시·군·구를 적어 주세요.";
  else if (tooLong(draft.city, MAX_LENGTHS.city)) errors.city = "시·군·구가 너무 길어요.";

  if (tooLong(draft.address, MAX_LENGTHS.address)) errors.address = "주소가 너무 길어요.";

  const year = digits(draft.foundedYear);
  if (year !== null && (year < FOUNDED_YEAR_MIN || year > currentYear()))
    errors.foundedYear = `${FOUNDED_YEAR_MIN}년부터 ${currentYear()}년 사이로 적어 주세요.`;

  const tel = blankToNull(draft.contactTel);
  if (tel !== null && tooLong(tel, MAX_LENGTHS.contactTel))
    errors.contactTel = "전화번호가 너무 길어요.";
  else if (tel !== null && !/\d/.test(tel)) errors.contactTel = "전화번호를 확인해 주세요.";

  const email = blankToNull(draft.contactEmail);
  if (email !== null && tooLong(email, MAX_LENGTHS.contactEmail))
    errors.contactEmail = "이메일이 너무 길어요.";
  else if (email !== null && !email.includes("@")) errors.contactEmail = "이메일을 확인해 주세요.";

  for (const key of Object.keys(CHURCH_CHANNELS) as ChurchChannel[]) {
    const raw = draft.links[key] ?? "";
    if (!trimmed(raw)) continue;
    if (tooLong(raw, MAX_CHANNEL_URL)) errors[`link:${key}`] = "주소가 너무 길어요.";
    else if (normalizeChannelUrl(raw) === null)
      errors[`link:${key}`] = "주소 형식이 아니에요. 예) cafe.naver.com/andongtaehwa";
  }

  return errors;
}

/**
 * 숫자만 남긴 정수 — `Number.parseInt("년1998")`은 `NaN`이라 앞에 글자가 붙으면 값을 잃는다.
 * 자릿수가 터진 값은 `null`로 버리지 않고 큰 수로 돌려 **범위 검증에 걸리게** 한다
 * (조용히 사라지면 교회는 저장된 줄 안다 · `job-draft`의 `money()`와 같은 관용구).
 */
function digits(value: string): number | null {
  const only = value.replace(/[^0-9]/g, "");
  if (!only) return null;
  const parsed = Number.parseInt(only, 10);
  return Number.isSafeInteger(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/**
 * `churches` UPDATE 패치 — **교회명·교단·인증상태·고유번호는 만들지 않는다**(인증 확정값).
 * ⚠️ `churches`엔 `updated_at`이 없다(`jobs`와 다르다) — 넣으려 하면 타입이 막는다.
 */
export function toChurchUpdate(draft: ChurchInfoDraft): TablesUpdate<"churches"> {
  return {
    region: draft.region,
    city: blankToNull(draft.city),
    address: blankToNull(draft.address),
    founded_year: digits(draft.foundedYear),
    contact_tel: blankToNull(draft.contactTel),
    contact_email: blankToNull(draft.contactEmail),
  };
}

/**
 * 채널 → 저장할 행. **비운 채널은 여기 없다** — 그 목록(`kept`)에 없는 행을 액션이 지운다.
 * ⚠️ 주소는 정규화된 값으로 저장한다(검증을 통과했으므로 `null`이 아니다).
 */
export function toChannelRows(
  draft: ChurchInfoDraft,
  churchId: string,
): { church_id: string; type: ChurchChannel; url: string }[] {
  return (Object.keys(CHURCH_CHANNELS) as ChurchChannel[]).flatMap((type) => {
    const url = normalizeChannelUrl(draft.links[type] ?? "");
    return url === null ? [] : [{ church_id: churchId, type, url }];
  });
}

/** 저장된 교회 → 폼 초기값. `toChurchUpdate`의 역방향이라 한 파일에 둔다 */
export function toInfoDraft(church: Church): ChurchInfoDraft {
  return {
    region: church.region,
    city: church.city ?? "",
    address: church.address ?? "",
    foundedYear: church.foundedYear?.toString() ?? "",
    contactTel: church.contactTel ?? "",
    contactEmail: church.contactEmail ?? "",
    links: Object.fromEntries(church.links.map((link) => [link.type, link.url])),
  };
}
