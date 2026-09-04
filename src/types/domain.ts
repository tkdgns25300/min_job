import type { ExposureWindow } from "@/lib/exposure-order";
import type { HiddenReason } from "@/lib/job-visibility";
import type {
  Denomination,
  Region,
  Position,
  Department,
  EmploymentType,
  Qualification,
  PayPeriod,
  FeaturedTier,
  JobKind,
  JobSource,
  JobStatus,
  ChurchChannel,
  ChurchStatus,
  ChurchVerificationStatus,
} from "@/constants/domain";

// 상태 enum은 constants(라벨 맵)로 이동 — 기존 import 경로 호환을 위해 재노출
export type { JobStatus };

// 목록 다중선택 필터 축. 정렬은 최신순 고정이라 키가 없다 —
// 사용자가 고르는 정렬축은 두지 않는다(사례비순 "세상적"·마감임박 개념 모호, INTERVIEWS).
export type FilterDim =
  "denomination" | "region" | "position" | "department" | "employmentType" | "qualification";

/**
 * 필터 칩에 붙는 건수 — 축마다 `{ 값: 건수 }`, 0인 값은 키가 없다.
 * 계산은 `(public)/jobs/filter-jobs`의 `facetCounts`가 하고, 여기 두는 이유는 `components/`의
 * 필터 UI가 같은 모양을 받아야 하는데 **`components/`는 `app/`을 import하지 않기** 때문이다.
 */
export type FacetCounts = Record<FilterDim, Record<string, number>>;

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
  address: string | null; // **상세 주소**(지역·시 다음 조각). 표시·지도는 churchPlaceLine이 이어 붙인다
  /**
   * 이 교회가 검증됐나 — **값은 둘뿐이다**(`ChurchStatus`). 행이 생기는 경로는 하나다(DATA §3):
   * 인증 신청에서 처음 등록하는 교회로 적어낸 순간 `PENDING`, 운영자가 승인하면 `APPROVED`.
   * ⚠️ 공개 조회는 `APPROVED`만 내려보낸다. 미승인 교회가 검수 전에 노출되면 안 된다.
   * ⚠️ 사람의 신청 상태(`CurrentUser.churchVerificationStatus`)와 **다른 값 집합**이다 — 거부는
   *    사람 쪽에만 있고, 교회를 내리는 것은 `PENDING`으로 되돌리기다.
   */
  verificationStatus: ChurchStatus;
  contactEmail: string | null; // 사무용 — 인증 검수 때 공개 출처와 대조하는 근거
  contactTel: string | null; // 〃
  foundedYear: number | null; // 창립 연도 (null = 미상)
  links: ChurchLink[]; // 교회 채널 — 없으면 빈 배열
}

// 교회 상세의 '지난 공고' 한 줄 — 마감된 공고를 최신순으로 보여주기 위한 최소 형태.
// (자리별 묶음·재공고 집계는 2026-08-07에 제거했다 — ROADMAP 1-4 참조)
export interface PastJob {
  id: string;
  position: Position[];
  role: string | null; // 일반직 지난 공고 — 없으면 자리 이름이 빈칸이 된다
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
   * 공고 시점에 파악한 교단. null = 미상·무소속 → **교단 필터에서 탈락**한다.
   * ⚠️ 의도적 비정규화(DATA §1 예외 1 — `region`과 근거가 같다). claim 뒤에도 이 값을 쓴다:
   *    교회 것과 다르면 `churches`가 정본이지만, 표시·필터는 공고가 말한 교단을 따른다(DATA §3).
   */
  denomination: Denomination | null;
  /**
   * 공고 시점에 파악한 광역. null = 미상 → **지역 필터에서 탈락**한다(검수에서 먼저 채울 값).
   * ⚠️ 의도적 비정규화(DATA §1 예외) — `churchId`가 null이면 `churches`를 JOIN할 수 없어
   *    지역 필터가 통째로 죽는다. 필터·정렬은 교회가 아니라 이 값을 쓴다.
   */
  region: Region | null;
  city: string | null; // 시·군·구 (표시용 자유 텍스트) — 〃 같은 이유로 공고가 직접 든다
  /**
   * **상세 주소** — `region`·`city` 다음 조각이다(`청수12로 29`). 도로명/지번은 안 나눈다.
   * 표시·지도 링크는 `churchPlaceLine`이 지역·시와 이어 붙여 만든다 — 이 값만 쓰면 동네를 잃는다.
   * ⚠️ `contactPost`(우편 접수처)와 **다른 값**이다 — 이건 교회 위치다.
   */
  address: string | null;
  title: string;
  jobKind: JobKind[]; // 사역직/일반직 — 최상위 채용 구분. 배열: 한 글에 두 종류가 섞인 공고 표현(DATA §3 판정 규칙)
  /**
   * 사역 직분 — **배열**. 자리 수·자격 범위를 전부 담는다(DATA §3 판정 규칙).
   * ⚠️ DB는 `text[] NULL`이지만 여기선 **non-null**이다 — CHECK ①이 `coalesce(cardinality(...), 0)`로
   *    NULL과 빈 배열을 같게 보고, 소비자도 구분하지 않는다(필터는 `.some()`, `positionLabel([])`은 "").
   *    seam이 `null → []`로 정규화한다. 빈 상태를 둘로 만들면 호출부가 전부 두 번 검사해야 한다.
   */
  position: Position[];
  department: Department | null;
  /** 고용형태. **null = 미상** — 원문 언급률 51%뿐이라 DB도 NULL 허용이다(DATA §3). 필터에서 탈락한다 */
  employmentType: EmploymentType | null;
  /**
   * 자격/경력 요건 (필터 전용 — 표시하는 화면은 없다).
   * ⚠️ **`null`은 "무관"이 아니라 "원문에 자격 이야기가 없다"** 이다. "무관이라고 적혀 있다"는
   *    `ANY`가 따로 받는다(크롤러가 갈라서 보낸다 · `constants/domain`의 `QUALIFICATIONS`).
   *    그래서 필터는 `null`을 어느 값에도 맞추지 않는다 — 안 적힌 것을 단정하지 않는다.
   */
  qualification: Qualification | null;
  /**
   * 모집 인원 — **자유 텍스트**. "약간명"·"1~2명" 같은 비정형이 흔해 숫자로 담지 않는다.
   * 한 글에 여러 자리가 있으면 원문을 그대로 담는다("1.부목사(전임) 2.교육목사") — Phase 2에서
   * 자리별로 나눌 때 이 값이 근거가 된다(DATA §3).
   */
  headcount: string | null;
  /** 부임 시기 — 자유 텍스트("즉시"·"협의"·"2월 중") */
  startTiming: string | null;
  /** 사택. **null = 정보 없음/협의 · true = 제공 · false = 명시적 미제공** — 셋을 구분한다(DATA §3) */
  housingProvided: boolean | null;
  /** 사택 비정형 표현("사택 협의"·"보증금 지원") — `payNote`가 `payMin`의 짝인 것과 같은 관계 */
  housingNote: string | null;
  /** 그 외 처우 비고(4대보험·교육비·안식월 등) — 자유 텍스트 */
  benefitNote: string | null;
  payMin: number | null; // 사례비·급여, 만원 단위. 월/연 여부는 payPeriod가 든다
  payMax: number | null;
  payNote: string | null; // "내규에 따름" 등 비정형 표현 보존
  /**
   * 금액이 월 기준인지 연 기준인지. **표시는 이 단위 그대로**, 필터만 월로 환산한다.
   * `payMin`이 null이면 의미가 없지만 DB가 NOT NULL DEFAULT 'MONTH'라 항상 값이 있다.
   */
  payPeriod: PayPeriod;
  status: JobStatus;
  postedAt: string; // "YYYY-MM-DD"
  deadline: string | null; // "YYYY-MM-DD", null = 상시모집
  // --- 상세 필드 ---
  workDays: string | null; // 출근 요일·시간 (자유 텍스트: "주일·수요" 등)
  requirements: string[]; // 자격요건 (항목 리스트)
  preferred: string[]; // 우대사항 (항목 리스트)
  requiredDocs: string[]; // 제출 서류 — **필수** (["이력서", "자기소개서", ...])
  optionalDocs: string[]; // 제출 서류 — **선택**. 배열 2개로 나눈다(jsonb `{name,required}`보다 표시가 단순)
  processSteps: string[]; // 전형 절차 (서류→면접→설교…) — 순서가 뜻을 가진다
  /**
   * 공고 본문 — 운영자 요약 또는 교회 작성(원문 통째 복제 X · 가드레일 #1). DB는 `NOT NULL`.
   * ⚠️ 빈 문자열은 막지 못한다 — 메타 description은 `||`로 폴백한다(`lib/seo.ts`).
   */
  description: string;
  source: JobSource; // 출처 — 운영자 등록 / 교회 직접 등록 (owner nullable 가드레일)
  sourceUrl: string | null; // 원문 링크 (운영자 수집 공고). 재호스팅 대신 링크로 안내
  /**
   * 일반직 직무 — **자유 텍스트**(통제 목록 아님): "행정간사"·"방송·미디어" 등. 사역직은 null.
   * 직분(`position`)의 일반직 짝이다 — `jobRoleLine`이 둘을 같은 자리에 놓고, 자유검색도 훑는다.
   */
  role: string | null;
  /**
   * 지원용 **공개** 연락처 4칸 — `APPLY_METHODS`(EMAIL·TEL·LINK·POST) 닫힌 4키와 1:1.
   * 가드레일 #3: 공고에 지원용으로 명시 공개된 것만 담는다(제3자 개인정보 X).
   *
   * ⚠️ **CHECK ②로 최소 하나는 반드시 있다.** `source_url`은 그 셈에 들어가지 않는다 —
   *    세면 크롤 공고가 항상 통과해 제약이 장식이 된다.
   * ⚠️ `contactPost`(우편 접수처)는 `address`(교회 위치)와 **다른 값**이다. 지도는 `address`를 쓴다.
   * ⚠️ `churches.contactEmail`·`contactTel`(사무용, 인증 검수 대조용)과도 **다르다** — 그쪽은
   *    공개 화면에 렌더하지 않는다(DATA §3).
   */
  contactEmail: string | null;
  contactTel: string | null;
  contactLink: string | null;
  contactPost: string | null;
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
  churchVerificationStatus: ChurchVerificationStatus | null; // 이 **사람**의 인증 상태. null = 미신청
  /**
   * 그 **교회**가 검증됐나 — `hasChurchAccess`가 사람·교회 양쪽을 봐야 해서 함께 싣는다.
   * 호출부 8곳이 전부 `CurrentUser` 하나만 받으므로 여기 실어야 한 곳도 빠뜨리지 않는다.
   * boolean인 이유: 호출부는 "승인됐나"만 알면 되고, 3상태를 주면 각자 해석할 여지가 생긴다.
   */
  churchIsVerified: boolean;
  /**
   * 반려 사유(`users.verification_rejection_reason`) — REJECTED일 때만 채워진다.
   * 이걸 싣지 않으면 신청자는 **뭘 고쳐야 할지 모른다**(반려 화면이 문구를 지어내게 된다).
   */
  churchRejectionReason: string | null;
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
  role: string | null;
  department: Department | null;
  employmentType: EmploymentType | null;
  qualification: Qualification | null;
  housingProvided: boolean | null;
  payMin: number | null;
  payMax: number | null;
  payNote: string | null;
  payPeriod: PayPeriod; // 카드 표시 + 사례비 필터의 월 환산에 쓴다
  /**
   * **오늘 유효한** 노출 등급 — 공고의 칸이 아니라 원장(`job_promotions`)에서 파생한다(2026-09-03).
   * seam이 오늘을 덮는 PAID 행을 읽어 채운다. 시작 전 예약은 `NONE`이다(아직 안 보인다).
   */
  featuredTier: FeaturedTier;
  postedAt: string;
  deadline: string | null;
}

/**
 * 자리에 놓인 카드 — `ad`는 **공고가 아니라 자리의 속성**이다(그 칸이 유료 배치인가).
 * 홈 "추천 청빙" 3칸(안 팔린 칸은 최신 공고가 서고 `ad=false`)과 공고 상세 "비슷한 공고"(위 3칸이 광고일 수
 * 있다)가 쓴다. 공고의 `featuredTier`에서 파생하지 않는 이유: 같은 공고가 유기적으로 뜬 자리에는 라벨이
 * 붙지 않아야 한다(SPEC 수익화 절).
 */
export interface PlacedJob {
  job: JobCard;
  ad: boolean;
}

// 운영자 공고 관리 테이블용 projection — 전체 상태·출처 포함(공개 카드와 달리 CLOSED·운영자/교회 구분). (admin/jobs)
export interface AdminJob {
  /** 공개 목록에 실제로 뜨는가 (DATA §6-1). `status`만 보면 내려간 공고를 "게재중"으로 표시하게 된다 */
  isPubliclyOpen: boolean;
  /** 내려간 이유 — 상태 배지를 사유별로 나누는 데 쓴다. 노출 중이거나 교회가 직접 마감했으면 null */
  hiddenReason: HiddenReason;
  id: string;
  title: string;
  church: Pick<JobChurchRef, "name" | "denomination" | "region">; // 운영자 테이블이 실제로 쓰는 것만
  position: Position[];
  role: string | null;
  department: Department | null;
  employmentType: EmploymentType | null;
  status: JobStatus;
  /** 유료 노출 창(노출 중·예약) — 없거나 끝났으면 null. 운영자가 "언제까지 팔린 자리인가"를 본다 */
  exposure: ExposureWindow | null;
  source: JobSource;
  postedAt: string;
  deadline: string | null;
}

// 운영자 홈의 공고 수치 — 공개 목록에 실제로 뜨는 것과, 게재중인데 안 뜨는 것.
// 둘 다 `isPubliclyOpen` 판정이 필요해 SQL이 아니라 JS가 센다(job-visibility가 단일 소스). (admin 홈)
export interface AdminOverview {
  visibleCount: number; // 공개 목록에 실제로 뜨는 공고
  hiddenCount: number; // 게재중이나 공개 목록에서 내려간 건수 — 운영자가 손봐야 할 대상
}

// 운영자가 처리해야 할 큐 하나의 상태 — 수집 검수·교회 인증이 같은 모양을 쓴다(홈이 한 컴포넌트로 그린다).
// `oldestAt`은 **적체 신호**다: 건수가 적어도 오래 묵은 건이 있으면 손대야 한다. (admin 홈)
export interface QueueSummary {
  count: number;
  oldestAt: string | null; // 가장 오래 기다린 건의 접수 시각(timestamptz) — 비었으면 큐가 비어 있다
}

// 교회 인증 신청 — 운영자 검수용 projection. 실구현은 users(담당자) + churches(교회) + 증빙 조인.
// 유일한 검수 게이트(공고 검수 없음). 담당자 개인정보는 인증 확인 목적 수집(공개 X, 가드레일 #3). (admin/verify)
export interface ChurchVerification {
  id: string;
  applicant: {
    name: string; // 실명 — Google 표시명은 닉네임일 수 있어 따로 받는다
    position: Position; // 직분 — 담임이 신청했는지가 검수 신뢰도 판단에 쓰인다
    email: string; // users.email (Google OAuth로 이미 검증됨) — 연락 수단
  };
  // 신청 대상 교회 — 운영자가 이 값을 공개 출처와 대조한다.
  church: {
    /**
     * **항상 있다** — 신규 교회로 적어냈어도 제출 시 `PENDING` 행이 먼저 생기기 때문이다
     * (DATA §3 경로 ①: 신청서에 적힌 교회명·교단·지역을 담을 컬럼이 `users`에 없다).
     */
    id: string;
    /** 그 교회 행의 검증 상태(조인) — `PENDING`이면 실재 여부부터 확인해야 할 교회다 */
    verificationStatus: ChurchStatus;
    name: string;
    /**
     * 고유번호 — **검수의 1번 대조값**이다. 운영자가 하는 일이 곧 "서류에 적힌 번호가 이 번호인가"라,
     * 화면에 없으면 서류를 열어도 맞춰 볼 것이 없다(2026-08-26에 빠져 있었다).
     */
    registrationNo: string;
    // 신규 등록 분기에서만 입력받는다(`verify-form`) — 기존 교회를 골랐으면 조인해 온
    // `churches` 값이고 그건 미상일 수 있다. 그래서 `Church`와 같이 nullable이다.
    denomination: Denomination | null;
    region: Region | null;
    city: string | null;
    /** 상세 주소 — 서류(고유번호증)에 소재지가 적혀 있어 대조에 쓴다. `Church.address`와 같은 값 */
    address: string | null;
    /**
     * 사무용 연락처 — **검증의 축**. 운영자가 공개 게시판 공고(`jobs.contact_*`)·홈페이지와 대조한다.
     * ⚠️ 신청자 개인 전화는 받지 않는다 — 사칭자가 자기 번호를 적고 자기가 받으므로 검증이 안 된다.
     * ⚠️ **`churches`에서 조인한 값이 아니라 신청자가 적어낸 값**이다(`users.verification_contact_*`).
     *    기존 교회 신청이면 `churches`의 값과 다를 수 있고, 그 차이가 곧 반려 근거다.
     */
    contactEmail: string | null;
    contactTel: string | null;
  };
  status: ChurchVerificationStatus; // PENDING / APPROVED / REJECTED
  /**
   * 제출 시각 — **오프셋 있는 ISO8601**(`users.verification_submitted_at`은 `timestamptz`).
   * ⚠️ 날짜 문자열이 아니다. 화면에 그대로 그리면 UTC가 나와 **날짜가 하루 어긋난다** —
   * 표시는 `formatKstDate`(lib/format)를 거친다.
   */
  submittedAt: string;
  /** 검수 시각(승인·반려 시) — 위와 같다. `null` = 아직 검수 전 */
  reviewedAt: string | null;
  rejectionReason: string | null; // 반려 사유 (REJECTED만)
}

/**
 * 판정 화면이 쓰는 신청 — 목록에 **증빙 서류를 싣지 않으려고** 나눈 타입이다.
 * ⚠️ 서류 URL은 30분 signed URL이라 목록에 실으면 ① 렌더마다 Storage 왕복이 한 번 늘고
 *    ② 목록 뷰가 client 컴포넌트라 **모든 신청자의 증빙 URL이 브라우저 페이로드로 나간다** —
 *    그릴 곳도 없는데. 서명은 상세에서만 한다(수집 검수도 `getReviewDetail`에서만 서명한다).
 */
export interface ChurchVerificationDetail extends ChurchVerification {
  /**
   * 증빙 서류. 저장하는 것은 **비공개 Storage 경로 하나**뿐이고(DATA §3 `users.verification_doc_path`)
   * 서류 종류·등록번호는 저장하지 않는다 — 열면 보이고, 저장하면 보관 부담만 진다.
   *
   * ⚠️ 파일명을 싣지 않는다 — 경로가 `{uid}/{uuid}.{ext}`라 **UUID는 사람에게 뜻이 없다**.
   *    화면이 알아야 하는 것은 "무엇으로 열리나"(`kind`)뿐이다.
   * ⚠️ `null` = 파기됨. **반려 처리가 파일을 지운다** — 자격 없는 신청의 증빙을 들고 있을 근거가 없다.
   *    승인분은 반대로 **자격이 유지되는 동안 보관**한다(2026-08-25 방침 개정 · `/privacy` §3).
   * ⚠️ `url === null` = 경로는 있는데 **서명에 실패**했다. 파기와 뜻이 달라 따로 둔다.
   */
  doc: { kind: "pdf" | "image"; url: string | null } | null;
}
