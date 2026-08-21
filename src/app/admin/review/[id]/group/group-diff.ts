import type { Tables } from "@/types/database";

// 묶음이 왜 불확실한가 — **저장된 값에서 계산한다.** 크롤러가 이유를 적어 두는 칸이 없고,
// 있다 해도 "무엇이 다른가"는 값을 나란히 놓으면 바로 나오는 사실이다.
//
// ⚠️ 라벨로 바꾸지 않고 **저장값을 그대로 비교한다.** 화면에 나가는 것은 칸 이름("접수 이메일")뿐이고,
//    라벨 맵은 1:1이라 키를 비교해도 답이 같다 — 굳이 바꾸면 캐스트만 늘어난다.

type ReviewData = Tables<"review_data">;

/** 비교하는 칸과 그 값 — 순서는 판단에 쓰는 순서(접수 경로가 가장 강한 신호다) */
const COMPARED: { label: string; of: (row: ReviewData) => string }[] = [
  { label: "접수 이메일", of: (r) => r.contact_email ?? "" },
  { label: "접수 전화", of: (r) => r.contact_tel ?? "" },
  { label: "접수 링크", of: (r) => r.contact_link ?? "" },
  { label: "접수 주소", of: (r) => r.contact_post ?? "" },
  { label: "직분", of: (r) => r.position.join(" · ") },
  { label: "직무명", of: (r) => r.role ?? "" },
  { label: "부서", of: (r) => r.department ?? "" },
  { label: "고용형태", of: (r) => r.employment_type ?? "" },
  { label: "지역", of: (r) => [r.region, r.city].filter(Boolean).join(" ") },
  { label: "사례비", of: (r) => [r.pay_min, r.pay_max, r.pay_period, r.pay_note].join("/") },
  { label: "마감일", of: (r) => r.deadline ?? "" },
];

/** 묶음 안에서 갈리는 칸의 이름 — 비어 있으면 "다른 점을 못 찾음"이고, 그것도 판단 재료다 */
export function groupDifferences(rows: ReviewData[]): string[] {
  return COMPARED.filter(({ of }) => new Set(rows.map(of)).size > 1).map(({ label }) => label);
}

/** 이 건의 접수 경로 요약 — 묶음에서 사람이 실제로 비교하는 값이다 */
export function contactSummary(row: ReviewData): string {
  return (
    [row.contact_email, row.contact_tel, row.contact_link, row.contact_post]
      .filter(Boolean)
      .join(" · ") || "접수 경로 없음"
  );
}
