import type { HiddenReason } from "@/lib/job-visibility";
import type {
  Denomination,
  Region,
  Position,
  Department,
  EmploymentType,
  Qualification,
  FeaturedTier,
  JobKind,
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
export type SortKey = "recent" | "pay" | "deadline";

// 교회 채널 링크 (홈페이지·SNS)
export interface ChurchLink {
  type: ChurchChannel;
  url: string;
}

// 교회
export interface Church {
  id: string;
  name: string;
  /** 교단. null = 미상 또는 무소속·독립교회 — `ETC`("소속은 있고 우리 9키에 없는 교단")와 구분한다(DATA §3) */
  denomination: Denomination | null;
  region: Region | null; // 광역 (필터용). null = 미상
  city: string | null; // 시·군·구 (표시용 자유 텍스트)
  address: string | null; // 주소 원문 그대로 (도로명/지번 안 나눔). 교회 상세 지도용
  foundedYear: number | null; // 창립 연도 (null = 미상)
  photos?: string[]; // 교회 사진(첫 장 = 커버). 없으면 기본 커버. 실 업로드는 Phase 1
  links: ChurchLink[]; // 교회 채널 — 없으면 빈 배열
}

// 교회 상세의 '지난 공고' 한 줄 — 마감된 공고를 최신순으로 보여주기 위한 최소 형태.
// (자리별 묶음·재공고 집계는 2026-08-07에 제거했다 — ROADMAP 1-4 참조)
export interface PastJob {
  id: string;
  position: Position[];
  department: Department | null;
  postedAt: string;
  deadline: string | null;
}

// 공고 — 스키마는 페이지 작업하며 확장한다. (상세 페이지에서 아래 상세 필드 확정)
export interface Job {
  id: string;
  /**
   * 소속 교회. **null = 아직 어느 교회인지 확정 못 함**(크롤링 공고 기본값 — 자동 매칭 금지).
   * 교회가 가입·인증 후 claim하면 채워지고, 그때 교회 상세·채널이 켜진다(DATA §3).
   */
  churchId: string | null;
  /** 공고가 말한 교회명 그대로 — `churchId`가 null이어도 교회를 표시할 수 있게 하는 값(DATA §3) */
  churchName: string;
  /**
   * 공고 시점에 파악한 광역. null = 미상 → **지역 필터에서 탈락**한다(검수에서 먼저 채울 값).
   * ⚠️ 의도적 비정규화(DATA §1 예외) — `churchId`가 null이면 `churches`를 JOIN할 수 없어
   *    지역 필터가 통째로 죽는다. 필터·정렬은 교회가 아니라 이 값을 쓴다.
   */
  region: Region | null;
  city: string | null; // 시·군·구 (표시용 자유 텍스트) — 〃 같은 이유로 공고가 직접 든다
  /**
   * 주소 원문 그대로(도로명/지번 안 나눔) — 〃. 지도가 쓴다.
   * ⚠️ `contact`(지원용 연락처)의 우편 접수처와 **다른 값**이다 — 이건 교회 위치다.
   */
  address: string | null;
  title: string;
  jobKind: JobKind[]; // 사역직/일반직 — 최상위 채용 구분. 배열: 한 글에 두 종류가 섞인 공고 표현(DATA §3 판정 규칙)
  position: Position[]; // 사역 직분 — **배열**. 자리 수·자격 범위를 전부 담는다(DATA §3 판정 규칙)
  department: Department | null;
  employmentType: EmploymentType;
  qualification?: Qualification; // 자격/경력 요건 (필터). 미지정 = 무관 취급. 실데이터에선 필수화 예정
  housingProvided?: boolean; // 사택 제공 여부 (필터). 실데이터에선 필수화 예정
  payMin: number | null; // 월 사례비, 만원 단위
  payMax: number | null;
  payNote: string | null; // "내규에 따름" 등 비정형 표현 보존
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
  role: string | null; // 일반직(GENERAL) 분류 자유텍스트(방송·행정 등). 사역직은 null
  contact: string | null; // 지원용 공개 연락처(전화·이메일·링크). 가드레일 #3
}

// 로그인 사용자 — 단일 계정 모델(DATA §3). 모든 계정은 기본 사역자(MINISTER).
// 교회 인증(증빙+운영자 승인) 통과 시 churchId 연결 + status=APPROVED → 교회 view 개방.
// 세션은 Supabase Auth 기반(lib/queries/users.ts). churchId·인증 상태는 교회 테이블 도입 후 채워진다.
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
  /** claim된 교회만. null = 미claim(크롤링 공고) → 교회 프로필 섹션·상세 링크·채널을 그리지 않는다 */
  church: Church | null;
  /**
   * 표시용 교회 정보 — **seam이 파생해서 내려준다**(호출부가 각자 조합하면 답이 갈린다).
   * 실제로 헤더는 공고의 이름, 프로필 섹션은 교회의 이름을 써서 **한 화면에 이름이 두 개** 나왔다.
   */
  churchRef: JobChurchRef;
  /**
   * 아직 지원할 수 있는 공고인가 — 마감일 경과·상시모집 90일 초과면 false (DATA.md §6-1).
   * ⚠️ `job.status`만 보면 안 된다. 상세 페이지는 프리렌더라 거기서 오늘 날짜를 만들 수 없어
   *    **판정을 seam(cached scope)이 해서 내려준다**(CLAUDE.md `'use cache'` 제약 #2).
   */
  isPubliclyOpen: boolean;
}

/**
 * 공고가 가리키는 교회 — **`churches` 조인 결과가 아니다.**
 * `church_id`가 null인 공고(크롤링·미claim)가 있어 이름·지역은 `jobs`가 직접 들고 있고,
 * 교단은 claim된 교회에서만 온다(DATA §3). **없는 값을 지어내지 않는다** — null은 null로 내려보낸다.
 */
export interface JobChurchRef {
  id: string | null; // claim된 교회만 — 교회 상세로 링크할 수 있는지의 판정
  name: string; // jobs.church_name (항상 있다)
  denomination: Denomination | null;
  region: Region | null;
  city: string | null;
  address: string | null; // 지도 전용 — 한 줄 표시(churchMetaLine)에는 안 들어간다
}

// 공고 카드 표시용 projection (공고 + 교회 참조)
export interface JobCard {
  id: string;
  /** 공개 목록에 뜨는가 (DATA §6-1) — 저장한 공고 목록은 만료된 것도 보여주되 마감으로 표시한다 */
  isPubliclyOpen: boolean;
  title: string;
  church: Omit<JobChurchRef, "id" | "address">; // 카드는 교회로 링크하지도, 지도를 그리지도 않는다
  position: Position[];
  department: Department | null;
  employmentType: EmploymentType;
  qualification?: Qualification;
  housingProvided?: boolean;
  payMin: number | null;
  payMax: number | null;
  payNote: string | null;
  featuredTier: FeaturedTier;
  postedAt: string;
  deadline: string | null;
}

// 교회 선택 옵션 — 이름·교단·지역만(공고 등록 시 인라인 매칭·자동완성). (admin/ingest)
export type ChurchOption = Pick<Church, "id" | "name" | "denomination" | "region">;

// 운영자 공고 관리 테이블용 projection — 전체 상태·출처 포함(공개 카드와 달리 CLOSED·PENDING·운영자/교회 구분). (admin/jobs)
export interface AdminJob {
  /** 공개 목록에 실제로 뜨는가 (DATA §6-1). `status`만 보면 내려간 공고를 "게재중"으로 표시하게 된다 */
  isPubliclyOpen: boolean;
  /** 내려간 이유 — 상태 배지를 사유별로 나누는 데 쓴다. 노출 중이거나 교회가 직접 마감했으면 null */
  hiddenReason: HiddenReason;
  id: string;
  title: string;
  church: Pick<JobChurchRef, "name" | "denomination" | "region">; // 운영자 테이블이 실제로 쓰는 것만
  position: Position[];
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
  featuredCount: number; // 노출중(유료) — 실제 공개 노출 기준(DATA §6-1)
  weekCount: number; // 이번 주 등록(오늘 기준 RECENT_WINDOW_DAYS)
  hiddenCount: number; // 게재중이나 공개 목록에서 내려간 건수 — 운영자가 손봐야 할 대상
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
  // 담당자가 신청서에 **직접 적은** 교회 정보 — `Church`와 달리 교단·지역이 필수다
  // (사람이 채우는 입력 폼이라 미상이 없다. 승인 시 이 값으로 churches 행을 만들거나 대조한다)
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
