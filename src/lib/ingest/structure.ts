import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  POSITIONS,
  REGIONS,
  PAY_NOTE_PRESETS,
  type Denomination,
  type Department,
  type EmploymentType,
  type Position,
  type Region,
} from "@/constants/domain";

// 사람이 확보한 공고 원문 → 구조화 초안. admin 수집 도구가 호출.
//
// ⚠️ 가드레일 #1: 입력은 항상 "사람이 붙여넣은 텍스트"다. 외부 사이트를 프로그램이 가져오는 코드를
//    이 모듈에 두지 않는다. 구조화(processing)만 자동화한다.
// ⚠️ mock 단계: 실제 AI 대신 키워드 휴리스틱으로 필드를 추정한다(정확도 낮음 → 반드시 사람이 검토·보정).
//    Phase 1엔 이 구조화를 Server Action으로 옮겨 Claude API(secret key, 서버 전용)를 호출한다:
//    호출부가 client→server로 바뀌고 async(Promise<IngestDraft>)가 되며, 입출력 계약(text→IngestDraft)만 유지.

// 구조화 초안 — 폼 프리필용. 추정 실패한 필드는 빈 값/ null → 사람이 검토·보정.
export interface IngestDraft {
  title: string;
  churchName: string;
  denomination: Denomination | null;
  region: Region | null;
  position: Position[]; // 배열 — 원문에 여러 직분이 나열될 수 있다(DATA §3)
  department: Department | null;
  employmentType: EmploymentType | null;
  payMin: string;
  payMax: string;
  payNote: string;
  deadline: string; // "YYYY-MM-DD" | ""
  sourceUrl: string;
  body: string; // 요약·본문 — 사람이 직접 작성(원문 통째 복제 X, 가드레일 #1: DB권·재호스팅). 원문은 좌측 패널에만.
}

// 빈 초안 — 입력이 비었을 때 반환(structureJobText 내부용).
function emptyIngestDraft(): IngestDraft {
  return {
    title: "",
    churchName: "",
    denomination: null,
    region: null,
    position: [],
    department: null,
    employmentType: null,
    payMin: "",
    payMax: "",
    payNote: "",
    deadline: "",
    sourceUrl: "",
    body: "",
  };
}

// 라벨 맵(한글) 중 텍스트에 포함된 첫 항목의 key. '기타(ETC)'는 검색어로 무의미해 제외.
// 라벨이 '·'로 나뉜 경우(예: '장년·교구', '찬양·예배') 조각 하나만 나와도 매칭한다.
function matchLabel<K extends string>(text: string, labels: Record<K, string>): K | null {
  for (const [key, label] of Object.entries(labels) as [K, string][]) {
    if (key === "ETC") continue;
    if (label.split("·").some((part) => text.includes(part))) return key;
  }
  return null;
}

// 직분 — 주력은 부교역자. "담임목사를 도와 섬길 부목사"처럼 담임목사가 함께 언급되는 공고가 많아,
// 담임목사는 다른 직분이 하나도 없을 때만 매칭한다(우선순위 최후).
const POSITION_PRIORITY: Position[] = [
  "ASSOCIATE_PASTOR",
  "EVANGELIST",
  "LICENSED_MINISTER",
  "SENIOR_PASTOR",
];
// 원문에 나열된 직분을 **전부** 뽑는다("1.부목사 2.교육목사 3.여전도사" → 부목사·전도사).
// 순서는 POSITION_PRIORITY 기준(담임은 최후 — 부목사 공고가 담임으로 뒤집히지 않게).
function matchPositions(text: string): Position[] {
  return POSITION_PRIORITY.filter((key) => text.includes(POSITIONS[key]));
}

// 고용형태 — "준전임"이 "전임"을 부분 포함하므로 좁은 것부터 검사(라벨은 constants에서).
function matchEmployment(text: string): EmploymentType | null {
  if (text.includes(EMPLOYMENT_TYPES.SEMI_FULL_TIME)) return "SEMI_FULL_TIME";
  if (text.includes(EMPLOYMENT_TYPES.PART_TIME)) return "PART_TIME";
  if (text.includes(EMPLOYMENT_TYPES.FULL_TIME)) return "FULL_TIME";
  return null;
}

// 사례비 — 명시 금액 우선(범위 → 단일). 금액이 없을 때만 비정형 표현(내규·협의)으로 추정.
function parsePay(text: string): Pick<IngestDraft, "payMin" | "payMax" | "payNote"> {
  const range = text.match(/(\d{2,4})\s*(?:만\s*원?)?\s*~\s*(\d{2,4})\s*만/);
  if (range) return { payMin: range[1], payMax: range[2], payNote: "" };

  const single = text.match(/(\d{2,4})\s*만\s*원?/);
  if (single) return { payMin: single[1], payMax: "", payNote: "" };

  const note = text.includes("내규")
    ? PAY_NOTE_PRESETS.find((p) => p.includes("내규"))
    : text.includes("협의")
      ? PAY_NOTE_PRESETS.find((p) => p.includes("협의"))
      : undefined;
  return { payMin: "", payMax: "", payNote: note ?? "" };
}

// 마감일 — "2026-09-30 / 2026.9.30 / 2026년 9월 30일" → YYYY-MM-DD.
// 부임 시작일과 혼동을 줄이려 '마감·접수·까지' 키워드 바로 뒤의 날짜를 우선, 없으면 문서 첫 날짜.
function parseDeadline(text: string): string {
  const fmt = (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const anchored = text.match(
    /(?:마감|접수|까지)[^\d]{0,6}(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/,
  );
  if (anchored) return fmt(anchored);
  const m = text.match(/(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
  return m ? fmt(m) : "";
}

/**
 * 붙여넣은 공고 원문을 구조화 초안으로 변환한다(mock 휴리스틱).
 * 추정이 빗나갈 수 있으므로 결과는 반드시 사람이 검토·수정한 뒤 등록한다.
 */
export function structureJobText(text: string): IngestDraft {
  const src = text.trim();
  if (!src) return emptyIngestDraft();

  const firstLine =
    src
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ?? "";

  return {
    title: firstLine,
    churchName: src.match(/[가-힣]{2,10}교회/)?.[0] ?? "",
    denomination: matchLabel(src, DENOMINATIONS),
    region: matchLabel(src, REGIONS),
    position: matchPositions(src),
    department: matchLabel(src, DEPARTMENTS),
    employmentType: matchEmployment(src),
    ...parsePay(src),
    deadline: parseDeadline(src),
    sourceUrl: src.match(/https?:\/\/[^\s)]+/)?.[0] ?? "",
    body: "", // 요약은 사람이 작성(원문 통째 복제 X). 원문은 좌측 패널 참조.
  };
}
