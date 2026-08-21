import { PUBLISHED_DENOMINATION_SOURCES } from "@/constants/review";

// 검수 큐의 "왜 봐야 하나" 판정 — 순수 함수. 목록과 단건이 같은 결과를 보여야 하므로 한 곳에 둔다.
//
// ⚠️ **크롤러의 등급 규칙을 베끼지 않는다.** 무엇이 `medium`인가는 실측으로 계속 바뀐다 —
//    베껴 두면 그쪽 규칙이 바뀔 때 우리 배지가 **조용히** 틀어진다. 여기 판정식은 전부
//    **저장된 사실**만 본다(크롤러 SPEC §4.4). 등급 자체는 이유를 담는 칸이 없어 계산해야 한다.

/** 배지 하나. `tone`은 시급함이 아니라 **성격**이다 — danger=공개하면 사고, warn=사람이 봐야, info=다른 화면으로 */
export interface ReviewFlag {
  key: string;
  label: string;
  tone: "danger" | "warn" | "info";
}

/**
 * 승격 필수 6칸의 입력 — **`ReviewEdits`도 이 타입을 만족한다**(lib/review-edits.ts).
 * 그래서 목록(저장된 행)과 단건 화면(고치는 중인 초안)이 **같은 함수로** 게이트를 계산한다.
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

/** 배지 판정에 필요한 `review_data` 조각 — 전 컬럼을 받지 않아 테스트가 짧아진다 */
export interface FlagInput extends GapInput {
  poster_paths: string[];
  is_church_recruitment: string;
  heresy_flag: boolean;
  dedup_state: string | null;
  denomination_source: string;
  /** 원문 쪽 — 그림을 못 받았는지 판정하려면 게시판에 그림이 있었는지를 알아야 한다 */
  imageCount: number;
}

/**
 * 승격 필수 6칸(min_job DATA §3 · 크롤러 SPEC §6.3) — **하나라도 비면 크롤러의 `jobs` INSERT가
 * CHECK로 실패한다.** 목록은 빈 것만(배지), 단건 화면은 여섯을 다 그린다(체크리스트).
 *
 * 목록을 상수로 둔 이유: 아래 판정식의 라벨이 이 상수를 벗어나면 **타입 에러**가 된다 —
 * 체크리스트와 판정이 조용히 어긋나는 것을 막는 유일한 장치다.
 */
export const PROMOTION_FIELDS = ["교회명", "제목", "종류", "직분·직무", "설명", "연락처"] as const;
export type PromotionField = (typeof PROMOTION_FIELDS)[number];

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

/**
 * 배지 목록. 여러 개가 함께 붙을 수 있다(예: 포스터 + 빈 칸).
 * 순서는 **판단 순서**다 — 공개하면 사고 나는 것부터.
 */
export function reviewFlags(r: FlagInput, gaps: PromotionField[]): ReviewFlag[] {
  const flags: ReviewFlag[] = [];

  if (r.heresy_flag) {
    flags.push({ key: "heresy", label: "이단 목록 일치", tone: "danger" });
  }
  if (gaps.length > 0) {
    flags.push({ key: "gaps", label: `빈 칸 · ${gaps.join("·")}`, tone: "danger" });
  }
  // 그림이 있었는데 올라간 파일이 없다 = 바이트를 못 받았다. 못 받았으면 올릴 것도 없으니
  // 없다는 사실 자체가 신호다(그래서 이걸 위한 별도 컬럼을 두지 않았다 — 크롤러 SPEC §4.4).
  if (r.imageCount > 0 && r.poster_paths.length === 0) {
    flags.push({ key: "no-image", label: "그림 못 받음", tone: "danger" });
  } else if (r.poster_paths.length > 0) {
    flags.push({ key: "poster", label: "포스터", tone: "warn" });
  }
  if (r.is_church_recruitment !== "YES") {
    flags.push({ key: "not-church", label: "개교회 여부 애매", tone: "warn" });
  }
  // 우편은 연락처 넷 중 **원문 대조를 거치지 않는 유일한 칸**이다(조립 칸) — 그것뿐이면
  // 지원 경로 전체가 확인된 적 없는 값이 된다. 틀리면 지원자가 엉뚱한 곳으로 서류를 보낸다.
  if (r.contact_post && !r.contact_email && !r.contact_tel && !r.contact_link) {
    flags.push({ key: "post-only", label: "우편 접수만", tone: "warn" });
  }
  if (!isDenominationPublished(r.denomination_source)) {
    flags.push({ key: "denomination", label: "교단 미확정", tone: "warn" });
  }
  if (r.dedup_state === "UNCERTAIN") {
    flags.push({ key: "dedup", label: "같은 자리 불확실", tone: "info" });
  }
  return flags;
}

/** 이 근거로는 교단이 공개되지 않는다 — 화면에는 보이는데 공개된 공고엔 비는 상태(크롤러 SPEC §6.4) */
export function isDenominationPublished(source: string): boolean {
  return PUBLISHED_DENOMINATION_SOURCES.some((published) => published === source);
}
