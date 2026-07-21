import churchesData from "./churches.json";
import jobsData from "./jobs.json";
import type { AdminJob, Church, Job, JobCard, JobDetail } from "@/types/domain";
import {
  getRepostInfo,
  groupByRole,
  type RepostInfo,
  type RoleHistory,
} from "@/lib/repost-tracking";
import { DENOMINATIONS, DEPARTMENTS, POSITIONS, REGIONS } from "@/constants/domain";

// mock 데이터 — 페이지를 만들며 채워나간다. 모든 페이지 완료 시 이 형태가 최종 스키마.
// (실제 DB 연동 시 lib/queries/*.ts + Supabase로 대체)
const churches = churchesData as unknown as Church[];
const jobs = jobsData as unknown as Job[];

const churchById = new Map(churches.map((c) => [c.id, c]));

function toCard(job: Job): JobCard {
  const church = churchById.get(job.churchId);
  return {
    id: job.id,
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
    stipendMin: job.stipendMin,
    stipendMax: job.stipendMax,
    stipendNote: job.stipendNote,
    featuredTier: job.featuredTier,
    postedAt: job.postedAt,
    deadline: job.deadline,
  };
}

const openJobs = jobs.filter((j) => j.status === "OPEN");

/** 대표광고(HERO) 공고 — 홈 추천 슬롯 */
export function getAdJobs(): JobCard[] {
  return openJobs.filter((j) => j.featuredTier === "HERO").map(toCard);
}

/** 리스트 공고 — 대표광고(HERO)는 별도 추천 슬롯이라 제외. 프리미엄 우선 + 최신순 */
export function getListJobs(limit = 8): JobCard[] {
  const rank = (t: string) => (t === "PREMIUM" ? 0 : 1);
  return openJobs
    .filter((j) => j.featuredTier !== "HERO")
    .sort(
      (a, b) => rank(a.featuredTier) - rank(b.featuredTier) || b.postedAt.localeCompare(a.postedAt),
    )
    .slice(0, limit)
    .map(toCard);
}

/** 전체 모집 중 공고 카드 (목록 페이지 클라이언트 필터용) */
export function getAllJobCards(): JobCard[] {
  return openJobs.map(toCard);
}

/** 공고 상세 — 공고 + 소속 교회 (없으면 null → notFound) */
export function getJobDetail(id: string): JobDetail | null {
  const job = jobs.find((j) => j.id === id);
  if (!job) return null;
  const church = churchById.get(job.churchId);
  if (!church) return null;
  return { job, church };
}

/** 재공고 정보 — 같은 교회·같은 자리의 반복 공고 집계 (마감 공고 포함) */
export function getRepost(id: string): RepostInfo | null {
  const job = jobs.find((j) => j.id === id);
  if (!job) return null;
  return getRepostInfo(job, jobs);
}

/** 교회 단건 (없으면 null → notFound) */
export function getChurch(id: string): Church | null {
  return churchById.get(id) ?? null;
}

/** 교회의 현재 모집 중 공고 (excludeId 지정 시 해당 공고 제외 — 공고 상세의 "이 교회 다른 모집") */
export function getChurchOpenJobs(churchId: string, excludeId?: string): JobCard[] {
  return openJobs.filter((j) => j.churchId === churchId && j.id !== excludeId).map(toCard);
}

/** 교회의 공고 이력 — 자리별 그룹(현재+지난, 재공고 집계). 검수 중(PENDING)은 공개 전이라 제외 */
export function getChurchTimeline(churchId: string): RoleHistory[] {
  return groupByRole(jobs.filter((j) => j.churchId === churchId && j.status !== "PENDING"));
}

/** 비슷한 공고 — 같은 부서 우선·같은 지역 보충 (현재 공고·같은 교회 제외) */
export function getSimilarJobs(id: string, limit = 4): JobCard[] {
  const base = jobs.find((j) => j.id === id);
  if (!base) return [];
  const baseChurch = churchById.get(base.churchId);
  const pool = openJobs.filter((j) => j.id !== id && j.churchId !== base.churchId);

  const byDept = pool.filter((j) => base.department !== null && j.department === base.department);
  const byRegion = pool.filter(
    (j) =>
      !byDept.includes(j) &&
      baseChurch != null &&
      churchById.get(j.churchId)?.region === baseChurch.region,
  );
  return [...byDept, ...byRegion].slice(0, limit).map(toCard);
}

// --- 인증(mock) — 세션·계정은 lib/mock-auth.ts. 아래는 마이페이지 데이터 조회. ---

// 마이페이지 관리 행 projection — 관리·표시에 필요한 필드만
function toMyJob(j: Job) {
  return {
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
 * 교회 관리 대시보드 — 그 교회 공고 전부(church_id 기준). 권한 = 교회 인증 멤버십(owner 일치 아님).
 * managed = 교회 직접 등록(source=CHURCH, 편집 대상) / claimableCount = 운영자 등록(owner 없음) 건수.
 * 운영자 등록 공고를 "가져와 관리"(클레임)하면 source가 CHURCH로 전환된다(Phase 1).
 */
export function getChurchDashboard(churchId: string) {
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
    managed: churchJobs.filter((j) => j.source === "CHURCH").map(toMyJob),
    claimableCount: churchJobs.filter((j) => j.source === "OPERATOR").length,
  };
}

/** 수정 가능 공고 — mock: owner 일치. 실구현은 "그 공고 church_id의 인증 관리자"로 판정(DATA §4). 불일치 → null(notFound) */
export function getEditableJob(id: string, userId: string): Job | null {
  const job = jobs.find((j) => j.id === id);
  return job && job.ownerId === userId ? job : null;
}

// --- 운영자(admin) — 전체 공고 관리. 실구현은 operator RLS(DATA §RLS) + 인증 게이트(Phase 1). ---

// 운영자 관리 행 projection — 전체 상태·출처 + 교회 조인(공개 카드와 달리 CLOSED·PENDING 포함)
function toAdminRow(job: Job): AdminJob {
  const church = churchById.get(job.churchId);
  return {
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
export function getAdminJobs(): AdminJob[] {
  return [...jobs].sort((a, b) => b.postedAt.localeCompare(a.postedAt)).map(toAdminRow);
}

/**
 * 검색어 완성 후보 어휘 — 현재 열린 공고에 실제로 존재하는
 * 직분·부서·지역·교단 라벨 + 교회명. 공고 수 많은 순 정렬(가나다 보조).
 * '기타(ETC)' 라벨은 검색어로 무의미해 제외. 클라이언트가 이 목록을 prefix/부분 매칭한다.
 */
export function getSearchSuggestions(): string[] {
  const counts = new Map<string, number>();
  const bump = (term: string | null | undefined) => {
    if (!term || term === "기타") return;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  };
  for (const j of openJobs) {
    const church = churchById.get(j.churchId);
    if (church) {
      bump(church.name);
      bump(REGIONS[church.region]);
      bump(DENOMINATIONS[church.denomination]);
    }
    bump(POSITIONS[j.position]);
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
export function getJobStats(): { openCount: number; newThisWeek: number; churchCount: number } {
  const openCount = openJobs.length;
  const churchCount = new Set(jobs.map((j) => j.churchId)).size;
  if (openCount === 0) return { openCount: 0, newThisWeek: 0, churchCount };
  // 결정성 유지: 기준일 = 최신 공고 등록일 (현재 시각 미사용)
  const latest = openJobs.reduce((m, j) => (j.postedAt > m ? j.postedAt : m), openJobs[0].postedAt);
  const ref = new Date(latest);
  ref.setDate(ref.getDate() - 7);
  const weekAgo = ref.toISOString().slice(0, 10);
  const newThisWeek = openJobs.filter((j) => j.postedAt >= weekAgo).length;
  return { openCount, newThisWeek, churchCount };
}

/**
 * about 커버리지 스탯 — 모집 중 공고 / 등록 교회 / 지역·교단 폭. 실 데이터 집계라 항상 정확.
 */
export function getCoverageStats(): {
  openCount: number;
  churchCount: number;
  regionCount: number;
  denominationCount: number;
} {
  return {
    openCount: openJobs.length,
    churchCount: churches.length,
    regionCount: new Set(churches.map((c) => c.region)).size,
    denominationCount: new Set(churches.map((c) => c.denomination)).size,
  };
}
