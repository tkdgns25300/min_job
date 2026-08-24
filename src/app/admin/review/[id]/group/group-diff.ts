import { DEPARTMENTS, EMPLOYMENT_TYPES, PAY_PERIODS, POSITIONS, REGIONS } from "@/constants/domain";
import { enumLabel, keysOf } from "@/lib/domain-enum";
import { positionLabel } from "@/lib/format";
import type { Tables } from "@/types/database";

// 묶음이 왜 불확실한가 — **저장된 값에서 계산한다.** 크롤러가 이유를 적어 두는 칸이 없고,
// 있다 해도 "무엇이 다른가"는 값을 나란히 놓으면 바로 나오는 사실이다.

type ReviewData = Tables<"review_data">;

/** 갈리는 칸 하나 — `values[i]`가 `rows[i]`의 값이다(구성원 줄이 자기 값을 찾을 수 있게) */
export interface GroupDifference {
  label: string;
  values: string[];
}

/**
 * 비교하는 칸과 그 값 — 순서는 판단에 쓰는 순서(접수 경로가 가장 강한 신호다).
 *
 * ⚠️ **라벨로 바꿔서 비교한다.** 이 값들은 이제 **화면에 그대로 나가므로**(구성원 줄) 저장값을
 *    쓰면 `ASSOCIATE_PASTOR`가 보인다. 라벨 맵은 1:1이라 비교 결과는 어느 쪽이든 같다.
 * ⚠️ **제목은 넣지 않는다** — 재게시는 제목을 조금씩 바꿔 올려서 거의 항상 "다른 점"이 되고,
 *    그러면 목록이 제목 하나로 찬다. 제목은 구성원 줄의 **첫 줄**에 통째로 보여준다.
 */
const COMPARED: { label: string; of: (row: ReviewData) => string }[] = [
  { label: "접수 이메일", of: (r) => r.contact_email ?? "" },
  { label: "접수 전화", of: (r) => r.contact_tel ?? "" },
  { label: "접수 링크", of: (r) => r.contact_link ?? "" },
  { label: "접수 주소", of: (r) => r.contact_post ?? "" },
  { label: "직분", of: (r) => positionLabel(keysOf(POSITIONS, r.position), { full: true }) },
  { label: "직무명", of: (r) => r.role ?? "" },
  { label: "부서", of: (r) => enumLabel(DEPARTMENTS, r.department) ?? "" },
  { label: "고용형태", of: (r) => enumLabel(EMPLOYMENT_TYPES, r.employment_type) ?? "" },
  { label: "지역", of: (r) => [enumLabel(REGIONS, r.region), r.city].filter(Boolean).join(" ") },
  { label: "사례비", of: payText },
  { label: "마감일", of: (r) => r.deadline ?? "" },
];

/** 묶음 안에서 갈리는 칸 — 비어 있으면 "다른 점을 못 찾음"이고, 그것도 판단 재료다 */
export function groupDifferences(rows: ReviewData[]): GroupDifference[] {
  return COMPARED.map(({ label, of }) => ({ label, values: rows.map(of) })).filter(
    ({ values }) => new Set(values).size > 1,
  );
}

/** 금액 한 줄 — 비교와 표시를 겸한다(주기·금액·비정형이 한 칸에 묶여 있어 조각째 비교하면 어긋난다) */
function payText(row: ReviewData): string {
  const { pay_min: min, pay_max: max } = row;
  const amount =
    min !== null && max !== null && min !== max
      ? `${min}~${max}만원`
      : min !== null
        ? `${min}만원`
        : max !== null
          ? `${max}만원`
          : null;
  return [amount && enumLabel(PAY_PERIODS, row.pay_period), amount, row.pay_note]
    .filter(Boolean)
    .join(" ");
}
