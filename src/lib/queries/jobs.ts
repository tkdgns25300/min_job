import { cacheLife, cacheTag } from "next/cache";
import {
  DENOMINATIONS,
  DEPARTMENTS,
  POSITIONS,
  RECENT_WINDOW_DAYS,
  REGIONS,
} from "@/constants/domain";
import { churchIdentityKey, jobChurchRef } from "@/lib/job-church";
import {
  addDays,
  hiddenReason,
  isFeaturedOn,
  isPubliclyOpen,
  todayInSeoul,
} from "@/lib/job-visibility";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllRows } from "./fetch-all";
import type { AdminJob, AdminOverview, JobCard, JobDetail } from "@/types/domain";
import { getChurch } from "./churches";
import {
  CHURCH_REF_EMBED,
  JOB_CARD_COLUMNS,
  JOB_FULL_COLUMNS,
  toJob,
  toJobCardFields,
  type ChurchRefRow,
  type JobCardFields,
  type JobCardRow,
} from "./row-map";

// 데이터 소스 seam (공고) — 페이지는 여기서만 가져온다.
//
// cached read라 `service.ts`(secret 키)를 쓴다. ⚠️ **그건 RLS를 우회한다** — "검수 통과 교회만 공개"
// 같은 노출 조건은 RLS가 아니라 **이 파일의 쿼리·술어가 직접** 걸어야 한다(DATA §9).

// 만료 판정 기준일은 **cached scope 안에서** 만든다 (CLAUDE.md `'use cache'` 제약 #2).
// 호출부(`/jobs`·홈·`sitemap.xml`)가 전부 프리렌더 스코프라 거기서 `new Date()`를 부르면
// **빌드 시각이 굳는다**. 여기서 만들면 `cacheLife("hours")`와 함께 한 시간마다 갱신되므로
// 만료가 최대 한 시간 늦게 반영되지만, 공고 목록 자체가 한 시간 캐시라 무해하다.
// 인자로 받으려면 호출부에 `await connection()`이 필요하고 `◐ PPR` → `ƒ` 로 떨어진다.

// ⚠️ 태그 기준은 "교회를 읽는가"가 아니라 **"결과가 교회에 따라 달라지는가"**다. 카드·상세는
//    검수 상태(APPROVED)로 교회 노출 여부가 갈리므로 `cacheTag("jobs", "churches")`를 함께 단다 —
//    교회가 승인되면 공고 캐시도 무효화돼야 한다. 반면 `getJobStats`·`getAdminOverview`는 같은
//    조회를 쓰지만 **교회 값을 결과에 쓰지 않는다**(교회 수는 `churchIdentityKey`가 `jobs` 컬럼만
//    본다) → "jobs"만 단다.

/**
 * SQL 선거름 — **판정이 아니라 부피 줄이기**다. 확실히 탈락하는 것만 뺀다(3천 건이 목표 규모다).
 * 진짜 판정은 `isPubliclyOpen`이 JS에서 한다 — 그 술어가 단일 소스이고 **크롤러가 사본을 들고 있어**
 * 규칙을 SQL로 한 벌 더 쓰면 사본이 셋이 된다(그래서 `jobs_visible` 뷰도 만들지 않았다).
 * ⚠️ `status`에 "보이는" 값이 추가되면 **여기도 함께 고친다** — job-visibility.ts의 통보 대상 ①.
 */
const VISIBLE_STATUS = "OPEN";

/** 카드 한 건 — 공고(카드 컬럼) + 교회 참조. `church_id`가 null이면 `church`도 null이다(크롤 공고) */
interface CardEntry {
  job: JobCardFields;
  church: ChurchRefRow | null;
}

type CardRow = JobCardRow & { churches: ChurchRefRow | null };

function toEntry(row: CardRow): CardEntry {
  const { churches, ...job } = row;
  return { job: toJobCardFields(job), church: churches };
}

/**
 * 카드 조회 한 장 — 최신순 + `id`로 마지막 정렬(장 경계에서 행이 새거나 겹치지 않게 · fetch-all).
 * ⚠️ **embed에 `!inner`를 쓰지 않는다**: 크롤 공고는 `church_id=NULL`이 정상이라(가드레일 #1)
 *    inner join이면 통째로 탈락한다.
 */
function cardPage(from: number, to: number, onlyVisible: boolean) {
  const query = createServiceClient()
    .from("jobs")
    .select(`${JOB_CARD_COLUMNS}, ${CHURCH_REF_EMBED}`, { count: "exact" })
    .order("posted_at", { ascending: false })
    .order("id")
    .range(from, to);
  return onlyVisible ? query.eq("status", VISIBLE_STATUS) : query;
}

/** 공개 목록 후보 — 테이블 전체를 훑으므로 페이지를 이어 붙인다(1,000행 상한 · fetch-all) */
async function fetchOpenCards(): Promise<CardEntry[]> {
  const rows = await fetchAllRows<CardRow>("공고 목록", (from, to) => cardPage(from, to, true));
  return rows.map(toEntry);
}

/** 전체 공고 — 마감·만료 포함. 저장한 공고·운영자 화면 전용 */
async function fetchAllCards(): Promise<CardEntry[]> {
  const rows = await fetchAllRows<CardRow>("공고 목록", (from, to) => cardPage(from, to, false));
  return rows.map(toEntry);
}

/**
 * 공개에 내보낼 교회인가 — **검수 통과분만**(DATA §3·§9).
 * 인증 신청에서 신규 교회로 적어낸 행은 검수 전 `PENDING`이다 — 그대로 내보내면 운영자가 보기 전에
 * 노출된다. `REJECTED`(허위 판명·opt-out으로 내린 교회)도 같은 문으로 막힌다.
 * ⚠️ 운영자 화면에는 걸지 않는다 — 검수 중인 교회도 보여야 한다(§9 "+ operator는 전체").
 */
function publicChurch(entry: CardEntry): { id: string } | null {
  const { church } = entry;
  return church && church.verification_status === "APPROVED" ? { id: church.id } : null;
}

/** 공개 목록 대상만 — 판정은 `lib/job-visibility` */
function onlyOpen(entries: CardEntry[], today: string): CardEntry[] {
  return entries.filter((e) => isPubliclyOpen(e.job, today));
}

function toCard(entry: CardEntry, today: string): JobCard {
  const { job } = entry;
  const church = jobChurchRef(job, publicChurch(entry));
  return {
    id: job.id,
    isPubliclyOpen: isPubliclyOpen(job, today),
    title: job.title,
    church: {
      name: church.name,
      denomination: church.denomination,
      region: church.region,
      city: church.city,
    },
    position: job.position,
    role: job.role,
    department: job.department,
    employmentType: job.employmentType,
    qualification: job.qualification,
    housingProvided: job.housingProvided,
    payMin: job.payMin,
    payMax: job.payMax,
    payNote: job.payNote,
    payPeriod: job.payPeriod,
    // 기한 지난 유료 노출은 등급을 내려서 내려보낸다 — 화면마다 만료를 다시 판정하지 않게(DATA §3)
    featuredTier: isFeaturedOn(job, today) ? job.featuredTier : "NONE",
    postedAt: job.postedAt,
    deadline: job.deadline,
  };
}

/** 대표광고(HERO) 공고 — 홈 추천 슬롯 */
export async function getAdJobs(): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  // 등급은 저장된 값이라 SQL로 미리 거른다 — 전 공고를 훑어 3건을 고르지 않는다.
  // 기한 만료는 여전히 JS가 본다(`toCard`) → 여기서 걸러도 결과가 달라지지 않는다.
  const rows = await fetchAllRows<CardRow>("대표광고 공고", (from, to) =>
    cardPage(from, to, true).eq("featured_tier", "HERO"),
  );
  return onlyOpen(rows.map(toEntry), today)
    .map((e) => toCard(e, today))
    .filter((c) => c.featuredTier === "HERO");
}

/** 리스트 공고 — 대표광고(HERO)는 별도 추천 슬롯이라 제외. 프리미엄 우선 + 최신순 */
export async function getListJobs(limit = 8): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  const rank = (tier: string) => (tier === "PREMIUM" ? 0 : 1);
  // 등급은 만료를 반영한 카드 값으로 판단한다 — 기한 지난 프리미엄이 앞자리를 차지하지 않게
  return onlyOpen(await fetchOpenCards(), today)
    .map((e) => toCard(e, today))
    .filter((c) => c.featuredTier !== "HERO")
    .sort((a, b) => rank(a.featuredTier) - rank(b.featuredTier))
    .slice(0, limit);
}

/** 전체 모집 중 공고 카드 (목록 페이지 클라이언트 필터용) — 만료분 제외 */
export async function getAllJobCards(): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  return onlyOpen(await fetchOpenCards(), today).map((e) => toCard(e, today));
}

/**
 * 저장한 공고(북마크) 해석용 카드 — **만료·마감분까지 포함**한다.
 * 북마크는 클라이언트 localStorage의 id 목록이라 서버가 전체 카드를 넘겨 매칭시킨다.
 * 공개 목록(`getAllJobCards`)을 쓰면 만료된 순간 저장한 공고가 **아무 안내 없이 증발**한다
 * — 카드의 `isPubliclyOpen`으로 "마감" 표시를 붙여 보여준다.
 * ⬜ 북마크를 계정 귀속(`bookmarks` 테이블)으로 옮기면 id로 조회해 이 전체 전달을 없앤다(ROADMAP).
 */
export async function getSavedJobCards(): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  return (await fetchAllCards()).map((e) => toCard(e, today));
}

/** 운영자 관리 행 — 전체 상태·출처 + 교회 조인(**검수 상태를 안 본다**: 운영자는 전체를 본다) */
function toAdminRow(entry: CardEntry, today: string): AdminJob {
  const { job, church } = entry;
  const ref = jobChurchRef(job, church ? { id: church.id } : null);
  return {
    isPubliclyOpen: isPubliclyOpen(job, today),
    hiddenReason: hiddenReason(job, today),
    id: job.id,
    title: job.title,
    church: { name: ref.name, denomination: ref.denomination, region: ref.region },
    position: job.position,
    role: job.role,
    department: job.department,
    employmentType: job.employmentType,
    status: job.status,
    featuredTier: isFeaturedOn(job, today) ? job.featuredTier : "NONE",
    source: job.source,
    postedAt: job.postedAt,
    deadline: job.deadline,
  };
}

/** 운영자 공고 관리 — 전체 공고(모든 상태·출처), 최신순. 탭·필터는 클라이언트 */
export async function getAdminJobs(): Promise<AdminJob[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  return (await fetchAllCards()).map((e) => toAdminRow(e, today));
}

/** 운영자 홈 요약 — 노출중(유료 OPEN)·이번주 등록·전체 공고. admin 홈 전용 */
export async function getAdminOverview(): Promise<AdminOverview> {
  "use cache";
  // 〃 — 요약 수치 넷 다 `jobs` 컬럼에서만 나온다
  cacheTag("jobs");
  cacheLife("hours");
  const today = todayInSeoul();
  const all = (await fetchAllCards()).map((e) => toAdminRow(e, today));
  // "노출중" = **실제로 공개 목록에 뜨는** 유료 공고. status만 보면 만료돼 숨겨진 유료 공고까지
  // 세어 운영자에게 부풀린 수치를 보여준다.
  return {
    featuredCount: all.filter((j) => j.featuredTier !== "NONE" && j.isPubliclyOpen).length,
    // 이번 주 = 오늘 기준 7일 내 — getJobStats와 같은 기준(둘이 갈리면 홈/admin 숫자가 어긋난다)
    weekCount: all.filter((j) => j.postedAt >= addDays(today, -RECENT_WINDOW_DAYS)).length,
    hiddenCount: all.filter((j) => j.hiddenReason !== null).length,
    totalCount: all.length,
  };
}

/**
 * 홈 스탯 — 지금 모집 중 / 이번 주 새 공고 / 청빙 중인 교회. 셋 다 **현재 시점** 기준으로 맞춘다.
 * ⚠️ 교회 수를 `church_id`로 세면 안 된다 — 미claim 공고는 전부 null이라 수백 곳이 **한 곳으로
 *    접힌다**. 집계 키는 `churchIdentityKey`(claim된 곳은 id, 나머지는 정규화 이름+지역)이고
 *    **정규화가 순수 JS라 SQL로 셀 수 없다**(DB에 함수를 만들지 않는다 · CLAUDE DB Policy).
 */
export async function getJobStats(): Promise<{
  openCount: number;
  newThisWeek: number;
  churchCount: number;
}> {
  "use cache";
  // 결과가 `jobs` 컬럼만으로 나온다 — 교회 승인이 이 수치를 바꾸지 않는다(위 태그 규칙)
  cacheTag("jobs");
  cacheLife("hours");
  const today = todayInSeoul();
  const open = onlyOpen(await fetchOpenCards(), today);
  const weekAgo = addDays(today, -RECENT_WINDOW_DAYS);
  return {
    openCount: open.length,
    newThisWeek: open.filter((e) => e.job.postedAt >= weekAgo).length,
    churchCount: new Set(open.map((e) => churchIdentityKey(e.job))).size,
  };
}

/**
 * about·pricing 커버리지 스탯 — 모집 중 공고 / **등록 교회**(`churches` 행) / 지역·교단 폭.
 *
 * ⚠️ `churchCount`가 홈의 "청빙 중인 교회"(`getJobStats`)와 **다른 값인 게 정상이다.**
 * 여긴 우리가 프로필까지 아는 **등록 교회 수**이고, 홈은 지금 청빙 중인 교회 수(미claim 포함)다.
 * ⬜ 크롤 데이터가 들어오면 이 수치가 서비스 규모를 크게 밑돌게 된다 — 라벨·출처를 다시 본다.
 */
export async function getCoverageStats(): Promise<{
  openCount: number;
  churchCount: number;
  regionCount: number;
  denominationCount: number;
}> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  const [open, rows] = await Promise.all([
    fetchOpenCards().then((entries) => onlyOpen(entries, today)),
    // 검수 전 교회는 공개 지표에서 뺀다 — `service.ts`가 RLS를 우회하므로 쿼리가 직접 건다
    fetchAllRows<{ region: string | null; denomination: string | null }>("교회 집계", (from, to) =>
      createServiceClient()
        .from("churches")
        .select("region, denomination", { count: "exact" })
        .eq("verification_status", "APPROVED")
        .order("id")
        .range(from, to),
    ),
  ]);

  // 미상(null)은 지역·교단 하나로 세지 않는다 — 그대로 두면 "교단 10개"처럼 조용히 +1 된다.
  return {
    openCount: open.length,
    churchCount: rows.length,
    regionCount: new Set(rows.map((c) => c.region).filter(Boolean)).size,
    denominationCount: new Set(rows.map((c) => c.denomination).filter(Boolean)).size,
  };
}

/**
 * 공고 상세 — 공고 + 소속 교회. **공고가 없을 때만** null(→ notFound)이다.
 * ⚠️ 교회가 없다고 404를 내면 안 된다 — 미claim 공고는 교회가 없는 게 정상이라
 *    크롤로 들어온 공고가 통째로 열리지 않게 된다. 교회 프로필 섹션만 빠진다.
 */
export async function getJobDetail(id: string): Promise<JobDetail | null> {
  "use cache";
  cacheTag("jobs", "churches", `job-${id}`);
  cacheLife("hours");
  const today = todayInSeoul();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_FULL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`공고 상세 조회 실패: ${error.message}`);
  if (!data) return null;

  const job = toJob(data);
  // 교회는 `churches` seam으로 읽는다 — "검수 통과분만"이라는 조건이 두 곳에 있으면 갈린다
  const church = job.churchId ? await getChurch(job.churchId) : null;
  return {
    job,
    church,
    churchRef: jobChurchRef(job, church),
    isPubliclyOpen: isPubliclyOpen(job, today),
  };
}

/**
 * 비슷한 공고 — 같은 부서 + 같은 지역 (현재 공고·같은 교회 제외). 둘 다 0건일 때만 직분으로 폴백.
 * ⚠️ 같은 교회 판정에 `churchId` 비교를 쓰면 안 된다 — 미claim 공고끼리는 둘 다 null이라
 *    서로 무관한 교회의 공고가 "같은 교회"로 묶여 통째로 걸러진다.
 * 지역 매칭은 `jobs.region`으로 한다 — 조인 없이 도는 값이다(DATA §1 예외).
 */
export async function getSimilarJobs(id: string, limit = 4): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  const entries = onlyOpen(await fetchOpenCards(), today);

  // 기준 공고는 만료·마감됐어도 필요하다(마감 배너의 "비슷한 공고 보기") — 목록에서 못 찾으면 따로 읽는다
  const base = entries.find((e) => e.job.id === id)?.job ?? (await fetchCardFields(id));
  if (!base) return [];

  const baseKey = churchIdentityKey(base);
  const pool = entries.filter((e) => e.job.id !== id && churchIdentityKey(e.job) !== baseKey);
  const byDept = pool.filter(
    (e) => base.department !== null && e.job.department === base.department,
  );
  const byRegion = pool.filter(
    (e) => !byDept.includes(e) && base.region !== null && e.job.region === base.region,
  );
  // 부서·지역이 둘 다 미상이면 위 두 단계가 통째로 비어 **"비슷한 공고"가 0건**이 된다
  // (하단 섹션과 마감 배너의 "비슷한 공고 보기"가 사라진 막다른 페이지). 그때만 직분으로 받쳐준다.
  // ⚠️ 일반 패딩으로 쓰면 안 된다 — 부서·지역이 다 다르고 직분만 겹치는 공고가 "비슷한 공고"의
  //    빈자리를 채워 추천 품질이 떨어진다.
  const byRelevance =
    byDept.length + byRegion.length > 0
      ? [...byDept, ...byRegion]
      : pool.filter((e) => e.job.position.some((p) => base.position.includes(p)));
  return byRelevance.slice(0, limit).map((e) => toCard(e, today));
}

/** 기준 공고 한 건(카드 컬럼만) — 공개 목록에 없는 공고의 유사 추천에 쓴다 */
async function fetchCardFields(id: string): Promise<JobCardFields | null> {
  const { data, error } = await createServiceClient()
    .from("jobs")
    .select(JOB_CARD_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`공고 조회 실패: ${error.message}`);
  return data ? toJobCardFields(data as unknown as JobCardRow) : null;
}

export async function getChurchOpenJobs(churchId: string, excludeId?: string): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  const { data, error } = await createServiceClient()
    .from("jobs")
    .select(`${JOB_CARD_COLUMNS}, ${CHURCH_REF_EMBED}`)
    .eq("church_id", churchId)
    .eq("status", VISIBLE_STATUS)
    .order("posted_at", { ascending: false });
  if (error) throw new Error(`교회 공고 조회 실패: ${error.message}`);

  return onlyOpen((data as unknown as CardRow[]).map(toEntry), today)
    .filter((e) => e.job.id !== excludeId)
    .map((e) => toCard(e, today));
}

/**
 * 검색어 완성 후보 어휘 — 현재 열린 공고에 실제로 존재하는
 * 직분·부서·지역·교단 라벨 + 교회명. 공고 수 많은 순 정렬(가나다 보조).
 * '기타(ETC)' 라벨은 검색어로 무의미해 제외. 클라이언트가 이 목록을 prefix/부분 매칭한다.
 */
export async function getSearchSuggestions(): Promise<string[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  const counts = new Map<string, number>();
  const bump = (term: string | null | undefined) => {
    if (!term || term === "기타") return;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  };
  // 교회명은 미claim 공고끼리 표기가 갈려("새길교회" / "대한예수교장로회(합동) 새길교회")
  // 같은 교회가 후보에 두 줄로 뜬다. 동일성 키로 묶고 **가장 짧은 표기**를 대표로 쓴다.
  // 최단 표기가 그룹 전원을 걸리게 하는 이유: 공백·접두어는 글자를 늘리기만 하므로 최단은 곧
  // 정규화형이고, 검색 인덱스(filter-jobs)가 각 공고의 정규화형도 함께 담는다. 둘은 한 쌍이다.
  const churchNames = new Map<string, { term: string; count: number }>();

  for (const entry of onlyOpen(await fetchOpenCards(), today)) {
    // 교회명·지역·교단은 seam이 정한 규칙(jobChurchRef)으로 읽는다 — 여기서 따로 조합하면
    // 자동완성이 제안한 말이 실제 카드에 안 적혀 있는 상황이 생긴다.
    const church = jobChurchRef(entry.job, publicChurch(entry));
    const key = churchIdentityKey(entry.job);
    const seen = churchNames.get(key);
    if (!seen) churchNames.set(key, { term: church.name, count: 1 });
    else {
      seen.count += 1;
      if (church.name.length < seen.term.length) seen.term = church.name;
    }
    if (church.region) bump(REGIONS[church.region]);
    if (church.denomination) bump(DENOMINATIONS[church.denomination]);
    for (const position of entry.job.position) bump(POSITIONS[position]);
    if (entry.job.department) bump(DEPARTMENTS[entry.job.department]);
  }
  for (const { term, count } of churchNames.values()) {
    // bump()를 우회하므로 빈 값 가드를 여기서 다시 건다 — `church_name`은 NOT NULL이지만 ""를
    // 막지 않고, 크롤러 구조화가 교회명을 못 뽑으면 빈 값이 온다(검수에서 채운다)
    if (!term) continue;
    counts.set(term, (counts.get(term) ?? 0) + count);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([term]) => term);
}
