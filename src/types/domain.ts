import type {
  Denomination,
  Region,
  Position,
  Department,
  EmploymentType,
  FeaturedTier,
  ChurchSize,
} from "@/constants/domain";

export type JobStatus = "OPEN" | "CLOSED";

// 목록 필터/정렬 (다중선택 필터 축 · 정렬 키)
export type FilterDim =
  "denomination" | "region" | "position" | "department" | "employmentType" | "size";
export type SortKey = "recent" | "stipend" | "deadline";

// 교회
export interface Church {
  id: string;
  name: string;
  denomination: Denomination;
  region: Region; // 광역 (필터용)
  city: string | null; // 시·군·구 (표시용 자유 텍스트)
  size: ChurchSize | null; // 교회 규모 (출석 성도 기준, null = 미상)
  homepageUrl: string | null;
  youtubeUrl: string | null;
}

// 공고 — 스키마는 페이지 작업하며 확장한다.
// (현재: 홈·목록에 필요한 필드. 상세/등록에서 workDays·제출서류·자격요건·본문 등 추가 예정)
export interface Job {
  id: string;
  churchId: string;
  title: string;
  position: Position;
  department: Department | null;
  employmentType: EmploymentType;
  stipendMin: number | null; // 월 사례비, 만원 단위
  stipendMax: number | null;
  stipendNote: string | null; // "내규에 따름" 등 비정형 표현 보존
  status: JobStatus;
  featuredTier: FeaturedTier;
  postedAt: string; // "YYYY-MM-DD"
  deadline: string | null; // "YYYY-MM-DD", null = 상시모집
}

// 공고 카드 표시용 projection (job + church 조인 결과)
export interface JobCard {
  id: string;
  title: string;
  church: Pick<Church, "name" | "denomination" | "region" | "city" | "size">;
  position: Position;
  department: Department | null;
  employmentType: EmploymentType;
  stipendMin: number | null;
  stipendMax: number | null;
  stipendNote: string | null;
  featuredTier: FeaturedTier;
  postedAt: string;
  deadline: string | null;
}
