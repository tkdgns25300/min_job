import { PUBLISHED_DENOMINATION_SOURCES } from "@/constants/review";

// 검수의 "확인할 것" 판정 — 순수 함수. 큐 목록·단건 화면·필터가 같은 답을 내야 하므로 한 곳에 둔다.
//
// ⚠️ **크롤러의 등급 규칙을 베끼지 않는다.** 무엇이 `medium`인가는 실측으로 계속 바뀐다 —
//    베껴 두면 그쪽 규칙이 바뀔 때 우리 판정이 **조용히** 틀어진다. 여기 판정식은 전부
//    **저장된 사실**만 본다(크롤러 SPEC §4.4). 등급 자체는 값이 흔들릴 수 있다는 신호로만 쓴다.

/**
 * 승격 필수 6칸(min_job DATA §3 · 크롤러 SPEC §6.3) — **하나라도 비면 크롤러의 `jobs` INSERT가
 * CHECK로 실패한다.** 목록은 빈 것만, 단건 화면은 여섯을 다 그린다.
 *
 * 목록을 상수로 둔 이유: 아래 판정식의 라벨이 이 상수를 벗어나면 **타입 에러**가 된다 —
 * 체크리스트와 판정이 조용히 어긋나는 것을 막는 유일한 장치다.
 */
export const PROMOTION_FIELDS = ["교회명", "제목", "종류", "직분·직무", "설명", "연락처"] as const;
export type PromotionField = (typeof PROMOTION_FIELDS)[number];

/**
 * 승격 필수 6칸의 입력 — `ReviewEdits`도 이 타입을 만족한다(lib/review-edits.ts).
 * 그래서 저장된 행과 고치는 중인 초안이 **같은 함수로** 게이트를 계산한다.
 * 배열·enum을 넓은 `string`으로 둔 것은 DB 행이 그 모양으로 오기 때문이다 — 좁히는 쪽이 편집용이다.
 */
export interface GapInput {
  church_name: string | null;
  title: string | null;
  job_kind: string[];
  position: string[];
  role: string | null;
  description: string | null;
  contact_email: string | null;
  contact_tel: string | null;
  contact_link: string | null;
  contact_post: string | null;
}

/**
 * 비어 있는 승격 필수 칸.
 * ⚠️ `posted_at`·`source_url`은 세지 않는다 — 크롤러 쪽에서 값 없이는 레코드가 만들어지지 않아
 *    검사가 항상 참이다(SPEC §6 각주).
 */
export function promotionGaps(r: GapInput): PromotionField[] {
  const hasSeat =
    (r.job_kind.includes("MINISTRY") ? r.position.length > 0 : true) &&
    (r.job_kind.includes("GENERAL") ? r.role !== null && r.role.trim() !== "" : true) &&
    (r.position.length > 0 || (r.role !== null && r.role.trim() !== ""));
  const hasContact = Boolean(r.contact_email || r.contact_tel || r.contact_link || r.contact_post);

  const checks: Record<PromotionField, boolean> = {
    교회명: Boolean(r.church_name?.trim()),
    제목: Boolean(r.title?.trim()),
    종류: r.job_kind.length > 0,
    "직분·직무": hasSeat,
    설명: Boolean(r.description?.trim()),
    연락처: hasContact,
  };
  return PROMOTION_FIELDS.filter((field) => !checks[field]);
}

/** 확인이 필요한 이유 — 큐 목록의 필터 선택지이자 단건 화면의 "확인할 것" 한 줄 */
export type AttentionKind =
  | "gap"
  | "noSource"
  | "noImage"
  | "heresy"
  | "notChurch"
  | "postOnly"
  | "denomination"
  | "dedup"
  | "unreadFile"
  | "fromImage"
  | "lowGrade";

/**
 * 얼마나 급한가 — **색을 나누는 근거**다.
 *
 * ⚠️ 색이 예쁘라고 있는 것이 아니라 **세 단계가 서로 다른 행동을 부른다**: `blocked`는 고치지
 *    않으면 승인이 안 되고, `judge`는 사람이 결론을 내야 하고, `note`는 알고만 있으면 된다.
 *    그래서 단계 이름이 곧 범례다 — 색만 다르고 뜻이 같은 배지는 만들지 않는다.
 */
export type AttentionLevel = "blocked" | "judge" | "note";

export interface Attention {
  kind: AttentionKind;
  label: string;
  level: AttentionLevel;
}

/**
 * 큐 목록 필터의 **고정 선택지**.
 *
 * ⚠️ 화면에 있는 행에서 모으지 않는다 — 그러면 첫 100건에 없는 유형이 **선택지에 아예 나타나지
 *    않아** 그 유형만 골라 보는 것이 불가능해진다(배지 label을 모아 쓰던 이전 방식의 문제).
 */
export const ATTENTION_KINDS: { kind: AttentionKind; label: string }[] = [
  { kind: "gap", label: "빈 칸 있음" },
  { kind: "noSource", label: "원문 없음" },
  { kind: "noImage", label: "그림 못 받음" },
  { kind: "heresy", label: "이단 목록 일치" },
  { kind: "notChurch", label: "개교회 여부 애매" },
  { kind: "postOnly", label: "우편 접수만" },
  { kind: "denomination", label: "교단 미확정" },
  { kind: "dedup", label: "같은 자리 불확실" },
  { kind: "unreadFile", label: "읽지 못한 첨부" },
  { kind: "fromImage", label: "그림에서 읽은 값" },
  { kind: "lowGrade", label: "등급 low" },
];

/** 판정에 필요한 `review_data` 조각 + 원문 쪽 두 값 — 전 컬럼을 받지 않아 테스트가 짧아진다 */
export interface AttentionInput extends GapInput {
  poster_paths: string[];
  is_church_recruitment: string;
  heresy_flag: boolean;
  dedup_state: string | null;
  denomination_source: string;
  confidence: string;
  /** 게시판에 그림이 있었는지 — 못 받은 것을 판정하려면 있었는지를 알아야 한다 */
  imageCount: number;
  /** 원문 본문 길이 — 그림도 본문도 없으면 대조할 원본이 없다는 뜻이다 */
  rawTextLength: number;
  /** 구조화가 못 읽은 첨부 수(이미지가 아닌 것) — 값이 그 안에만 있을 수 있다 */
  unreadFiles: number;
  /**
   * 받은 포스터 중 **이미지**의 수. `poster_paths`를 그대로 세지 않는 이유: 거기엔 **PDF도 섞여
   * 오는데**(크롤러 SPEC §7.1) 크롤러는 PDF를 Gemini에 보내지 않는다 — 그걸 세면 "그림에서 읽은
   * 값"이 **읽은 적 없는 파일을 근거로 삼는 거짓말**이 된다(실측 2026-08-23 · PUTS 건).
   */
  imagePosters: number;
}

/**
 * 확인할 것 — 여러 개가 함께 나올 수 있다. 순서는 **판단 순서**다(공개하면 사고 나는 것부터).
 *
 * ⚠️⚠️ **크롤러가 `PENDING`으로 넘기는 사유를 하나도 빠뜨리지 않아야 한다.** 빠지면 그 행이
 *    "확인할 것 없음"으로 보여 **크롤러가 사람을 부른 이유가 화면에서 사라진다** — 그대로 승인하게
 *    만드는 가장 나쁜 오작동이다. 크롤러 SPEC §5.7의 사유와 이 목록의 대응:
 *      `low`    승격 6칸 빔 → `gap` · 게이트1 UNCERTAIN → `notChurch` · 그림 못 받음 → `noImage`
 *      `medium` **그림을 보냄 → `fromImage`** · `contact_post`만 → `postOnly` · 이단 → `heresy`
 *      dedup    UNCERTAIN → `dedup`
 *    나머지(`noSource`·`unreadFile`·`denomination`·`lowGrade`)는 우리가 더 얹은 것이다.
 *    → 2026-08-23 실측: `fromImage`가 빠져 있어 PENDING 69건 중 **8건(12%)이 "확인할 것 없음"**
 *      으로 나왔다. 전부 포스터 건이었다.
 */
export function reviewAttention(r: AttentionInput, gaps: PromotionField[]): Attention[] {
  const list: Attention[] = [];
  const add = (kind: AttentionKind, label: string, level: AttentionLevel) =>
    list.push({ kind, label, level });

  if (r.heresy_flag) add("heresy", "이단 목록 일치", "judge");
  if (gaps.length > 0) add("gap", `빈 칸 · ${gaps.join("·")}`, "blocked");
  // 그림도 본문도 없다 = 대조할 원본이 화면에 없다. 게시판을 열지 않고 승인하면 근거 없는 공개다.
  if (r.rawTextLength === 0 && r.imageCount === 0 && r.poster_paths.length === 0) {
    add("noSource", "원문 없음", "judge");
  } else if (r.imageCount > 0 && r.poster_paths.length === 0) {
    // 그림이 있었는데 올라간 파일이 없다 = 바이트를 못 받았다. 없다는 사실 자체가 신호다.
    add("noImage", "그림 못 받음", "judge");
  }
  if (r.is_church_recruitment !== "YES") add("notChurch", "개교회 여부 애매", "judge");
  // 우편은 연락처 넷 중 **원문 대조를 거치지 않는 유일한 칸**이다(조립 칸) — 그것뿐이면
  // 지원 경로 전체가 확인된 적 없는 값이 된다. 틀리면 지원자가 엉뚱한 곳으로 서류를 보낸다.
  if (r.contact_post && !r.contact_email && !r.contact_tel && !r.contact_link) {
    add("postOnly", "우편 접수만", "judge");
  }
  if (!isDenominationPublished(r.denomination_source)) add("denomination", "교단 미확정", "note");
  if (r.dedup_state === "UNCERTAIN") add("dedup", "같은 자리 불확실", "judge");
  // hwp·pdf는 구조화가 열지 않는다(이미지만 Gemini에 보낸다). 본문이 "첨부파일 참조" 한 줄이고
  // 내용 전부가 문서 안에 있는 공고가 실제로 있다 — 그 값들은 **아무도 읽지 않은 채** 만들어졌다.
  if (r.unreadFiles > 0) add("unreadFile", "읽지 못한 첨부", "judge");
  // 그림에서 읽은 값 — 크롤러가 사람을 부르는 **가장 흔한 사유**다(PENDING의 85%). 문제라는 뜻이
  // 아니라 "코드가 대조한 칸이 하나도 없다"는 뜻이라, 눈으로 볼 사람이 반드시 필요하다.
  // 흔하므로 **뒤에** 둔다 — 앞에 두면 모든 줄이 같은 말로 시작해 정작 급한 것이 밀린다.
  if (r.imagePosters > 0) add("fromImage", "그림에서 읽은 값", "note");
  // 등급은 이유를 말하지 않지만 "값이 흔들릴 수 있다"는 신호는 된다 — 맨 뒤에 둔다.
  if (r.confidence === "low") add("lowGrade", "등급 low", "note");
  return list;
}

/** 이 근거로는 교단이 공개되지 않는다 — 화면에는 보이는데 공개된 공고엔 비는 상태(크롤러 SPEC §6.4) */
export function isDenominationPublished(source: string): boolean {
  return PUBLISHED_DENOMINATION_SOURCES.some((published) => published === source);
}
