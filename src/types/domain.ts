import type {
  Denomination,
  Region,
  Position,
  Department,
  EmploymentType,
  FeaturedTier,
  ChurchSize,
  JobSource,
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

// 공고 — 스키마는 페이지 작업하며 확장한다. (상세 페이지에서 아래 상세 필드 확정)
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
  // --- 상세 필드 ---
  workDays: string | null; // 출근 요일·시간 (자유 텍스트: "주일·수요" 등)
  requirements: string[]; // 자격요건 (항목 리스트)
  preferred: string[]; // 우대사항 (항목 리스트)
  requiredDocs: string[]; // 제출 서류 (["이력서", "자기소개서", ...])
  description: string | null; // 공고 본문 (운영자 요약 or 교회 작성 — 원문 통째 복제 X)
  source: JobSource; // 출처 — 운영자 등록 / 교회 직접 등록 (owner nullable 가드레일)
  sourceUrl: string | null; // 원문 링크 (운영자 수집 공고). 재호스팅 대신 링크로 안내
}

// 공고 상세 페이지용 — 공고 + 소속 교회 전체
export interface JobDetail {
  job: Job;
  church: Church;
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
