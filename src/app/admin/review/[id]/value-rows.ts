// 검수하는 값의 **키와 라벨** — 이 파일이 "무엇을 몇 개 검수하는가"의 단일 소스다.
//
// 왜 따로 두나: 확인 체크가 **값 하나씩**이라(운영자 결정 2026-08-23 · 묶음 단위 체크를 대체)
// 진행률의 분모가 필요하고, 그 수를 손으로 적어 두면 줄을 추가할 때 조용히 어긋난다.
// 줄은 라벨을 여기서 읽어 그리므로 **여기 없는 줄은 만들 수 없다**(타입 에러).

export const ROW_LABELS = {
  churchName: "교회명",
  title: "제목",
  denomination: "교단",
  region: "지역",
  kind: "종류",
  seat: "직분·직무",
  department: "부서",
  employmentType: "고용형태",
  pay: "사례비",
  deadline: "마감일",
  postedAt: "게시일",
  headcount: "모집 인원",
  startTiming: "부임 시기",
  workDays: "출근",
  housing: "사택",
  benefit: "복리후생",
  requiredDocs: "필수 서류",
  optionalDocs: "선택 서류",
  qualification: "자격",
  requirements: "요건",
  preferred: "우대",
  description: "설명",
  processSteps: "절차",
  address: "주소",
  contact: "연락처",
} as const;

export type RowKey = keyof typeof ROW_LABELS;

/**
 * 확인 체크의 분모.
 *
 * ⚠️ 보장은 **한 방향**이다 — 줄은 라벨을 이 맵에서 읽으므로 **여기 없는 줄은 만들 수 없다**(타입
 *    에러). 반대로 여기 키를 남긴 채 줄을 지우면 분모만 커진다(진행률이 끝까지 안 찬다). 줄을
 *    없앨 때 키도 함께 지운다 — 실제로 그리는 줄 수는 화면 테스트가 지킨다.
 */
export const ROW_COUNT = Object.keys(ROW_LABELS).length;

/** 확인 체크 — 화면 상태다(저장하지 않는다 · 승인을 막지 않는다) */
export interface Checks {
  has: (name: RowKey) => boolean;
  toggle: (name: RowKey) => void;
}
