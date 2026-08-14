import churchesData from "./churches.json";
import jobsData from "./jobs.json";
import verificationsData from "./church-verifications.json";
import type {
  AdminJob,
  AdminOverview,
  Church,
  ChurchOption,
  ChurchVerification,
  Job,
  JobCard,
  JobDetail,
  PastJob,
} from "@/types/domain";
import { addDays, hiddenReason, isPubliclyOpen } from "@/lib/job-visibility";
import {
  DENOMINATIONS,
  DEPARTMENTS,
  POSITIONS,
  RECENT_WINDOW_DAYS,
  REGIONS,
} from "@/constants/domain";

// mock 데이터 — 페이지를 만들며 채워나간다. 모든 페이지 완료 시 이 형태가 최종 스키마.
// (실제 DB 연동 시 lib/queries/*.ts + Supabase로 대체)
const churches = churchesData as unknown as Church[];
const jobs = jobsData as unknown as Job[];
const verifications = verificationsData as unknown as ChurchVerification[];

const churchById = new Map(churches.map((c) => [c.id, c]));

function toCard(job: Job, today: string): JobCard {
  const church = churchById.get(job.churchId);
  return {
    id: job.id,
    isPubliclyOpen: isPubliclyOpen(job, today),
    title: job.title,
    church: {
      name: church?.name ?? "알 수 없는 교회",
      denomination: church?.denomination ?? "ETC",
      region: church?.region ?? "SEOUL",
      city: church?.city ?? null,
    },
    position: job.position,
    department: job.department,
    employmentType: job.employmentType,
    qualification: job.qualification,
    housingProvided: job.housingProvided,
    payMin: job.payMin,
    payMax: job.payMax,
    payNote: job.payNote,
    featuredTier: job.featuredTier,
    postedAt: job.postedAt,
    deadline: job.deadline,
  };
}

/** 공개 목록 대상 공고 (호출 시점의 today 기준) — 판정은 lib/job-visibility */
function openJobsOn(today: string): Job[] {
  return jobs.filter((j) => isPubliclyOpen(j, today));
}

/** 대표광고(HERO) 공고 — 홈 추천 슬롯 */
export function getAdJobs(today: string): JobCard[] {
  return openJobsOn(today)
    .filter((j) => j.featuredTier === "HERO")
    .map((j) => toCard(j, today));
}

/** 리스트 공고 — 대표광고(HERO)는 별도 추천 슬롯이라 제외. 프리미엄 우선 + 최신순 */
export function getListJobs(today: string, limit = 8): JobCard[] {
  const rank = (t: string) => (t === "PREMIUM" ? 0 : 1);
  return openJobsOn(today)
    .filter((j) => j.featuredTier !== "HERO")
    .sort(
      (a, b) => rank(a.featuredTier) - rank(b.featuredTier) || b.postedAt.localeCompare(a.postedAt),
    )
    .slice(0, limit)
    .map((j) => toCard(j, today));
}

/** 전체 모집 중 공고 카드 (목록 페이지 클라이언트 필터용) — 만료분 제외 */
export function getAllJobCards(today: string): JobCard[] {
  return openJobsOn(today).map((j) => toCard(j, today));
}

/**
 * 저장한 공고(북마크) 해석용 카드 — **만료·마감분까지 포함**한다.
 * 북마크는 클라이언트 localStorage의 id 목록이라 서버가 전체 카드를 넘겨 매칭시킨다.
 * 공개 목록(`getAllJobCards`)을 쓰면 만료된 순간 저장한 공고가 **아무 안내 없이 증발**한다
 * — 카드의 `isPubliclyOpen`으로 "마감" 표시를 붙여 보여준다. 검수 중(PENDING)은 공개 전이라 제외.
 * (Phase 1에서 계정 귀속 bookmarks 테이블 서버 조회로 대체 — 이 전체-카드 전달은 mock 과도기)
 */
export function getSavedJobCards(today: string): JobCard[] {
  return jobs.filter((j) => j.status !== "PENDING").map((j) => toCard(j, today));
}

/** 공고 상세 — 공고 + 소속 교회 (없으면 null → notFound) */
export function getJobDetail(id: string, today: string): JobDetail | null {
  const job = jobs.find((j) => j.id === id);
  if (!job) return null;
  const church = churchById.get(job.churchId);
  if (!church) return null;
  return { job, church, isPubliclyOpen: isPubliclyOpen(job, today) };
}

/** 교회 단건 (없으면 null → notFound) */
export function getChurch(id: string): Church | null {
  return churchById.get(id) ?? null;
}

/** 교회 선택 옵션 — 이름·교단·지역만, 가나다순. 공고 등록 시 인라인 매칭·자동완성(admin/ingest) */
export function getChurchOptions(): ChurchOption[] {
  return churches
    .map((c) => ({ id: c.id, name: c.name, denomination: c.denomination, region: c.region }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/** 교회의 현재 모집 중 공고 (excludeId 지정 시 해당 공고 제외 — 공고 상세의 "이 교회 다른 모집") */
export function getChurchOpenJobs(churchId: string, today: string, excludeId?: string): JobCard[] {
  return openJobsOn(today)
    .filter((j) => j.churchId === churchId && j.id !== excludeId)
    .map((j) => toCard(j, today));
}

/**
 * 교회의 지난 공고 — 최신순. 검수 중(PENDING)은 공개 전이라 제외.
 * ⚠️ `status === "CLOSED"`만 보면 **만료된 OPEN 공고가 현재 목록에도 지난 공고에도 안 뜬다**
 *    (실측 35개 교회 중 8곳이 통째로 빈 페이지가 됐다). 공개에서 내려간 것은 전부 여기로 모은다.
 */
export function getChurchPastJobs(churchId: string, today: string): PastJob[] {
  return jobs
    .filter((j) => j.churchId === churchId && j.status !== "PENDING" && !isPubliclyOpen(j, today))
    .map((j) => ({
      id: j.id,
      position: j.position,
      department: j.department,
      postedAt: j.postedAt,
      deadline: j.deadline,
    }))
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}

/** 비슷한 공고 — 같은 부서 우선·같은 지역 보충 (현재 공고·같은 교회 제외) */
export function getSimilarJobs(id: string, today: string, limit = 4): JobCard[] {
  const base = jobs.find((j) => j.id === id);
  if (!base) return [];
  const baseChurch = churchById.get(base.churchId);
  const pool = openJobsOn(today).filter((j) => j.id !== id && j.churchId !== base.churchId);

  const byDept = pool.filter((j) => base.department !== null && j.department === base.department);
  const byRegion = pool.filter(
    (j) =>
      !byDept.includes(j) &&
      baseChurch != null &&
      churchById.get(j.churchId)?.region === baseChurch.region,
  );
  return [...byDept, ...byRegion].slice(0, limit).map((j) => toCard(j, today));
}

// --- 마이페이지 데이터 조회(mock) — 세션·계정은 Supabase Auth(lib/queries/users.ts). ---

// 마이페이지 관리 행 projection — 관리·표시에 필요한 필드만
function toMyJob(j: Job, today: string) {
  return {
    isPubliclyOpen: isPubliclyOpen(j, today),
    hiddenReason: hiddenReason(j, today),
    id: j.id,
    title: j.title,
    status: j.status,
    featuredTier: j.featuredTier,
    postedAt: j.postedAt,
    deadline: j.deadline,
    position: j.position,
    department: j.department,
    employmentType: j.employmentType,
    source: j.source,
  };
}

/**
 * 교회 관리 대시보드 — 그 교회 공고 전부(church_id 기준). 권한 = 교회 인증 멤버십.
 * managed = 교회 직접 등록(source=CHURCH, **편집 대상**) / claimableCount = 운영자 등록(클레임 대상) 건수.
 * ⚠️ 이 managed 조건은 `getEditableJob`의 편집 게이트와 **같은 술어**여야 한다(화면과 동작 일치).
 * 운영자 등록 공고를 "가져와 관리"(클레임)하면 source가 CHURCH로 전환된다(Phase 1).
 */
export function getChurchDashboard(churchId: string, today: string) {
  const church = churchById.get(churchId);
  const churchJobs = jobs
    .filter((j) => j.churchId === churchId)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  return {
    church: church
      ? {
          name: church.name,
          denomination: church.denomination,
          region: church.region,
          city: church.city,
        }
      : null,
    managed: churchJobs.filter((j) => j.source === "CHURCH").map((j) => toMyJob(j, today)),
    claimableCount: churchJobs.filter((j) => j.source === "OPERATOR").length,
  };
}

/**
 * 수정 가능 공고 — 권한 = 그 공고 church_id의 인증 관리자(DATA §4).
 * ⚠️ `source=CHURCH`만 편집 대상. 운영자 등록 공고는 **클레임("가져오기")을 거쳐야** 편집된다
 * — 교회 대시보드가 managed/claimable을 나눠 보여주므로, 여기서 열어주면 화면과 어긋난다.
 * 다른 교회 공고·미클레임 공고 → null(notFound)
 */
export function getEditableJob(id: string, churchId: string): Job | null {
  const job = jobs.find((j) => j.id === id);
  return job && job.churchId === churchId && job.source === "CHURCH" ? job : null;
}

// --- 운영자(admin) — 전체 공고 관리. 실구현은 operator RLS(DATA §RLS) + 인증 게이트(Phase 1). ---

// 운영자 관리 행 projection — 전체 상태·출처 + 교회 조인(공개 카드와 달리 CLOSED·PENDING 포함)
function toAdminRow(job: Job, today: string): AdminJob {
  const church = churchById.get(job.churchId);
  return {
    isPubliclyOpen: isPubliclyOpen(job, today),
    hiddenReason: hiddenReason(job, today),
    id: job.id,
    title: job.title,
    church: {
      id: church?.id ?? job.churchId,
      name: church?.name ?? "알 수 없는 교회",
      denomination: church?.denomination ?? "ETC",
      region: church?.region ?? "SEOUL",
    },
    position: job.position,
    department: job.department,
    employmentType: job.employmentType,
    status: job.status,
    featuredTier: job.featuredTier,
    source: job.source,
    postedAt: job.postedAt,
    deadline: job.deadline,
  };
}

/** 운영자 공고 관리 — 전체 공고(모든 상태·출처), 최신순. 탭·필터는 클라이언트가 처리 */
export function getAdminJobs(today: string): AdminJob[] {
  return [...jobs]
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .map((j) => toAdminRow(j, today));
}

/** 운영자 홈 요약 — 노출중·이번주·전체. (공고 검수 제거: 교회 인증이 유일 게이트) */
export function getAdminOverview(today: string): AdminOverview {
  const all = getAdminJobs(today); // 최신순 AdminJob[]
  // "노출중" = **실제로 공개 목록에 뜨는** 유료 공고. status만 보면 만료돼 숨겨진 유료 공고까지
  // 세어 운영자에게 부풀린 수치를 보여준다(실측 7건).
  const featuredCount = all.filter((j) => j.featuredTier !== "NONE" && j.isPubliclyOpen).length;
  // 이번 주 = 오늘 기준 7일 내 — getJobStats와 같은 기준(둘이 갈리면 홈/admin 숫자가 어긋난다)
  const weekCount = all.filter((j) => j.postedAt >= addDays(today, -RECENT_WINDOW_DAYS)).length;
  const hiddenCount = all.filter((j) => j.hiddenReason !== null).length;
  return { featuredCount, weekCount, hiddenCount, totalCount: all.length };
}

/**
 * 교회 인증 신청 — 운영자 검수 목록(유일한 검수 게이트). 작업 큐 정렬:
 * 검수 대기(PENDING) 먼저(오래된 신청 우선), 처리 완료는 최근 처리 순.
 */
export function getVerifications(): ChurchVerification[] {
  return [...verifications].sort((a, b) => {
    const aPending = a.status === "PENDING";
    const bPending = b.status === "PENDING";
    if (aPending !== bPending) return aPending ? -1 : 1;
    if (aPending) return a.submittedAt.localeCompare(b.submittedAt); // 대기: 오래된 것 먼저
    return (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""); // 완료: 최근 처리 먼저
  });
}

/**
 * 검색어 완성 후보 어휘 — 현재 열린 공고에 실제로 존재하는
 * 직분·부서·지역·교단 라벨 + 교회명. 공고 수 많은 순 정렬(가나다 보조).
 * '기타(ETC)' 라벨은 검색어로 무의미해 제외. 클라이언트가 이 목록을 prefix/부분 매칭한다.
 */
export function getSearchSuggestions(today: string): string[] {
  const counts = new Map<string, number>();
  const bump = (term: string | null | undefined) => {
    if (!term || term === "기타") return;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  };
  for (const j of openJobsOn(today)) {
    const church = churchById.get(j.churchId);
    if (church) {
      bump(church.name);
      bump(REGIONS[church.region]);
      bump(DENOMINATIONS[church.denomination]);
    }
    for (const p of j.position) bump(POSITIONS[p]);
    if (j.department) bump(DEPARTMENTS[j.department]);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([term]) => term);
}

/**
 * 홈 스탯 — 지금 모집 중 / 이번 주 새 공고 / 함께하는 교회(누적 참여).
 * 함께하는 교회 = 공고를 올린 적 있는 교회 수(누적) — "청빙 중 교회"와 다른 개념.
 */
export function getJobStats(today: string): {
  openCount: number;
  newThisWeek: number;
  churchCount: number;
} {
  const open = openJobsOn(today);
  const churchCount = new Set(jobs.map((j) => j.churchId)).size;
  // "이번 주" = 오늘 기준 7일 내. (구: 최신 공고 등록일을 오늘 대신 쓰던 우회 — today가 생겨 제거)
  const weekAgo = addDays(today, -RECENT_WINDOW_DAYS);
  const newThisWeek = open.filter((j) => j.postedAt >= weekAgo).length;
  return { openCount: open.length, newThisWeek, churchCount };
}

/**
 * about 커버리지 스탯 — 모집 중 공고 / 등록 교회 / 지역·교단 폭. 실 데이터 집계라 항상 정확.
 */
export function getCoverageStats(today: string): {
  openCount: number;
  churchCount: number;
  regionCount: number;
  denominationCount: number;
} {
  return {
    openCount: openJobsOn(today).length,
    churchCount: churches.length,
    regionCount: new Set(churches.map((c) => c.region)).size,
    denominationCount: new Set(churches.map((c) => c.denomination)).size,
  };
}
