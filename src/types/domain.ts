import type {
  Denomination,
  Region,
  Position,
  Department,
  EmploymentType,
  Qualification,
  FeaturedTier,
  JobSource,
  JobStatus,
  ChurchChannel,
  ChurchVerificationStatus,
  VerificationDocType,
} from "@/constants/domain";

// 상태 enum은 constants(라벨 맵)로 이동 — 기존 import 경로 호환을 위해 재노출
export type { JobStatus };

// 목록 필터/정렬 (다중선택 필터 축 · 정렬 키)
export type FilterDim =
  "denomination" | "region" | "position" | "department" | "employmentType" | "qualification";
export type SortKey = "recent" | "stipend" | "deadline";

// 교회 채널 링크 (홈페이지·SNS)
export interface ChurchLink {
  type: ChurchChannel;
  url: string;
}

// 교회
export interface Church {
  id: string;
  name: string;
  denomination: Denomination;
  region: Region; // 광역 (필터용)
  city: string | null; // 시·군·구 (표시용 자유 텍스트)
  foundedYear: number | null; // 창립 연도 (null = 미상)
  photos?: string[]; // 교회 사진(첫 장 = 커버). 없으면 기본 커버. 실 업로드는 Phase 1
  links: ChurchLink[]; // 교회 채널 — 없으면 빈 배열
}

// 공고 — 스키마는 페이지 작업하며 확장한다. (상세 페이지에서 아래 상세 필드 확정)
export interface Job {
  id: string;
  churchId: string;
  title: string;
  position: Position;
  department: Department | null;
  employmentType: EmploymentType;
  qualification?: Qualification; // 자격/경력 요건 (필터). 미지정 = 무관 취급. 실데이터에선 필수화 예정
  housingProvided?: boolean; // 사택 제공 여부 (필터). 실데이터에선 필수화 예정
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
  ownerId?: string | null; // 소유 계정(교회 직접 등록만) — 운영자 공고는 없음. 가드레일 #2: 공고를 user에 강결합하지 않는다
}

// 로그인 사용자 — 단일 계정 모델(DATA §3). 모든 계정은 기본 사역자(MINISTER).
// 교회 인증(증빙+운영자 승인) 통과 시 churchId 연결 + status=APPROVED → 교회 view 개방.
// Phase 1에서 Supabase Auth 세션 기반으로 대체.
export interface CurrentUser {
  id: string;
  email: string;
  name: string | null; // 담당자 표시명 (헤더·드롭다운)
  churchId: string | null; // 관리하는 교회 (인증 신청/완료 시). null = 일반 사역자
  churchName: string | null; // 표시용 (게이트·헤더) — 실구현은 join
  churchVerificationStatus: ChurchVerificationStatus | null; // null = 미신청
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
  church: Pick<Church, "name" | "denomination" | "region" | "city">;
  position: Position;
  department: Department | null;
  employmentType: EmploymentType;
  qualification?: Qualification;
  housingProvided?: boolean;
  stipendMin: number | null;
  stipendMax: number | null;
  stipendNote: string | null;
  featuredTier: FeaturedTier;
  postedAt: string;
  deadline: string | null;
}

// 운영자 공고 관리 테이블용 projection — 전체 상태·출처 포함(공개 카드와 달리 CLOSED·PENDING·운영자/교회 구분). (admin/jobs)
export interface AdminJob {
  id: string;
  title: string;
  church: Pick<Church, "id" | "name" | "denomination" | "region">;
  position: Position;
  department: Department | null;
  employmentType: EmploymentType;
  status: JobStatus;
  featuredTier: FeaturedTier;
  source: JobSource;
  postedAt: string;
  deadline: string | null;
}

// 운영자 홈 요약 — 요약 수치. (admin 홈) ※ 공고 검수 제거 — 교회 인증이 유일 게이트
export interface AdminOverview {
  featuredCount: number; // 노출중(유료, OPEN)
  weekCount: number; // 이번 주 등록(최신 게시일 기준 7일)
  totalCount: number; // 전체 공고
}

// 교회 인증 신청 — 운영자 검수용 projection. 실구현은 users(담당자) + churches(교회) + 증빙 조인.
// 유일한 검수 게이트(공고 검수 없음). 담당자 개인정보는 인증 확인 목적 수집(공개 X, 가드레일 #3). (admin/verify)
export interface ChurchVerification {
  id: string;
  applicant: {
    name: string; // 담당자 이름
    position: Position; // 담당자 직분 (enum)
    email: string;
    phone: string;
  };
  church: {
    id: string | null; // 기존 교회 매칭 — null = 신규 교회 생성 신청
    name: string;
    denomination: Denomination;
    region: Region;
    city: string | null;
  };
  document: {
    type: VerificationDocType; // 고유번호증 / 사업자등록증
    registrationNumber: string; // 고유번호 / 사업자등록번호
    fileName: string; // 업로드 파일명 — 실구현은 비공개 Storage 경로(DATA §3)
  };
  status: ChurchVerificationStatus; // PENDING / APPROVED / REJECTED
  submittedAt: string; // "YYYY-MM-DD"
  reviewedAt: string | null; // 검수 완료일 (승인·반려 시)
  rejectionReason: string | null; // 반려 사유 (REJECTED만)
}
