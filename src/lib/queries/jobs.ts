import { cacheLife, cacheTag } from "next/cache";
import {
  DENOMINATIONS,
  DEPARTMENTS,
  HOME_AD_SLOTS,
  POSITIONS,
  RECENT_WINDOW_DAYS,
  REGIONS,
  SIMILAR_JOBS_COUNT,
  tiersForSlot,
  type FeaturedTier,
} from "@/constants/domain";
import { churchIdentityKey, jobChurchRef } from "@/lib/job-church";
import { pickSimilarJobs } from "@/lib/similar-jobs";
import { addDays, hiddenReason, isPubliclyOpen, todayInSeoul } from "@/lib/job-visibility";
import type { ExposureWindow } from "@/lib/exposure-order";
import {
  FACET_JOBS_SHOWN,
  FACET_AXES,
  facetGroups,
  facetKeys,
  facetPath,
  filterByFacet,
  type FacetAxis,
  type FacetGroup,
} from "@/lib/job-facets";
import { getActiveExposure } from "./promotions";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllRows } from "./fetch-all";
import type { Tables } from "@/types/database";
import type { AdminJob, AdminOverview, JobCard, JobDetail, PlacedJob } from "@/types/domain";
import { getChurch } from "./churches";
import {
  CHURCH_REF_EMBED,
  JOB_CARD_COLUMNS,
  JOB_FULL_COLUMNS,
  publicChurch,
  toCard,
  toEntry,
  toJob,
  toJobCardFields,
  type CardEntry,
  type CardRow,
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

/** 전체 공고 — 마감·만료 포함. 운영자 화면 전용 */
async function fetchAllCards(): Promise<CardEntry[]> {
  const rows = await fetchAllRows<CardRow>("공고 목록", (from, to) => cardPage(from, to, false));
  return rows.map(toEntry);
}

/** 공개 목록 대상만 — 판정은 `lib/job-visibility` */
function onlyOpen(entries: CardEntry[], today: string): CardEntry[] {
  return entries.filter((e) => isPubliclyOpen(e.job, today));
}

type ExposureMap = Map<string, ExposureWindow>;

/**
 * 노출 등급 — **오늘 실제로 보이는 것만**. 시작 전 예약(`active=false`)은 `NONE`이다:
 * 며칠 뒤부터 시작하는 광고가 오늘 목록 맨 위에 서면 아직 오지 않은 기간의 자리를 준 셈이 된다.
 */
function activeTier(exposure: ExposureMap, jobId: string): FeaturedTier {
  const window = exposure.get(jobId);
  return window?.active ? window.tier : "NONE";
}

/**
 * 공개 목록 카드 — 공고와 **원장을 함께** 읽어 등급까지 채운 뒤 내려보낸다(2026-09-03).
 * 두 조회가 서로를 기다릴 이유가 없어 나란히 던진다. 원장은 결제 건수만큼이라 아주 작다.
 */
async function openCards(today: string): Promise<JobCard[]> {
  const [entries, exposure] = await Promise.all([fetchOpenCards(), getActiveExposure()]);
  return onlyOpen(entries, today).map((e) => toCard(e, today, activeTier(exposure, e.job.id)));
}

export interface HomeFeed {
  /** "추천 청빙" 3칸 — 스페셜이 서고, 안 팔린 칸은 최신 공고(`ad=false`) */
  slots: PlacedJob[];
  /** 그 아래 "청빙 공고" — 순수 최신순. 추천 칸에 선 공고는 뺀다(같은 화면에 두 번 나오지 않게) */
  latest: JobCard[];
}

/**
 * 홈 피드 — 추천 3칸 + 최신 목록을 **한 번에** 만든다. 둘을 따로 캐시하면 "칸에 선 공고를 목록에서 뺀다"를
 * 맞출 수 없다(각자 다른 엔트리라 서로를 모른다).
 * 추천 칸은 항상 3칸이다(SPEC 수익화 절): 스페셜이 여럿이면 최신순으로 3장, 모자라면 최신 공고가 채운다.
 */
export async function getHomeFeed(latestLimit = 8): Promise<HomeFeed> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  const cards = await openCards(today);
  const homeTiers = new Set<FeaturedTier>(tiersForSlot("home"));

  const slots: PlacedJob[] = cards
    .filter((card) => homeTiers.has(card.featuredTier))
    .slice(0, HOME_AD_SLOTS)
    .map((job) => ({ job, ad: true }));
  for (const card of cards) {
    if (slots.length >= HOME_AD_SLOTS) break;
    if (!slots.some((slot) => slot.job.id === card.id)) slots.push({ job: card, ad: false });
  }

  const placed = new Set(slots.map((slot) => slot.job.id));
  const latest = cards.filter((card) => !placed.has(card.id)).slice(0, latestLimit);
  return { slots, latest };
}

/** 전체 모집 중 공고 카드(목록 페이지 클라이언트 필터용) — 만료분 제외 */
export async function getAllJobCards(): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  return openCards(todayInSeoul());
}

/** 지역·직분·부서 랜딩 한 장이 쓰는 것 — 상위 공고 + 총 건수 + 분포 블록 */
export interface FacetJobs {
  /** 화면에 그리는 몫만(`FACET_JOBS_SHOWN`) — 나머지는 `/jobs`가 받는다 */
  jobs: JobCard[];
  /** 그 축의 전체 건수 — 제목·색인 판정(`FACET_INDEX_MIN`)이 이 값을 본다 */
  total: number;
  groups: FacetGroup[];
}

/**
 * 랜딩 한 장 — **이미 캐시된 전체 목록을 재사용**한다(`getAllJobCards`).
 *
 * 축마다 DB를 새로 훑으면 28개 랜딩이 빌드 때 전수 조회를 28번 돈다. 여기서는 조회가 **한 번**이고
 * (모든 랜딩이 같은 캐시 엔트리를 나눠 쓴다) 축별 파생은 순수 함수가 한다(`lib/job-facets`).
 * 태그도 같아서 공고가 바뀌면 목록과 랜딩이 **함께** 비워진다.
 */
export async function getFacetJobs(axis: FacetAxis, key: string): Promise<FacetJobs> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const matched = filterByFacet(await getAllJobCards(), axis, key);
  return {
    jobs: matched.slice(0, FACET_JOBS_SHOWN),
    total: matched.length,
    groups: facetGroups(matched, axis),
  };
}

/** 랜딩 한 칸 — 라벨은 담지 않는다(`facetLabel`이 단일 소스). 허브 블록과 sitemap이 같은 값을 쓴다 */
export interface FacetCount {
  key: string;
  path: string;
  count: number;
}

export type FacetCountsByAxis = Record<FacetAxis, FacetCount[]>;

/**
 * 랜딩 28칸의 건수 — `/jobs` 허브 블록과 `sitemap.xml`이 쓴다. 여기도 전체 목록 하나를 재사용한다.
 * 순서는 도메인 정의 순(라벨 맵 순서)이다 — 건수 순으로 흔들면 허브 블록이 매시간 재배열된다.
 *
 * ⚠️ `getFacetJobs`와 **다른 캐시 엔트리**다(같은 태그·같은 수명). 그래서 건수가 색인 임계값
 *    (`FACET_INDEX_MIN`) 근처인 축은 둘이 갱신되는 사이 잠깐 어긋날 수 있다 — sitemap엔 있는데
 *    페이지는 `noindex`이거나 그 반대. 한 시간 안에 맞춰지고 검색엔진은 페이지 쪽을 믿으므로 둔다.
 */
export async function getFacetCounts(): Promise<FacetCountsByAxis> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const all = await getAllJobCards();
  const byAxis = {} as FacetCountsByAxis;
  for (const axis of FACET_AXES) {
    byAxis[axis] = facetKeys(axis).map((key) => ({
      key,
      path: facetPath(axis, key),
      count: filterByFacet(all, axis, key).length,
    }));
  }
  return byAxis;
}

/**
 * id로 고른 카드 — **마감·만료 포함**(최근 본 공고가 쓴다: 본 공고가 마감됐으면 "마감"으로 보여야
 * 하고, 조용히 빠지면 안 된다). 지워진 공고는 결과에 없다 — 호출부는 그걸 근거로 걸러낸다.
 *
 * 캐시 키는 **정렬한 id 집합**이다 — `getJobDetail(id)`가 id마다 캐시되는 것과 같은 결. 같은 열 개를
 * 본 사람들은 한 엔트리를 나눠 쓰고, `cacheTag("jobs")`로 공고가 바뀌면 함께 비워진다.
 * ⚠️ 호출부(Server Action)가 개수·모양을 먼저 거른다 — 여기는 신뢰한 인자만 받는다.
 */
export async function getJobCardsByIds(ids: string[]): Promise<JobCard[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  if (ids.length === 0) return [];
  const today = todayInSeoul();
  const [{ data, error }, exposure] = await Promise.all([
    createServiceClient()
      .from("jobs")
      .select(`${JOB_CARD_COLUMNS}, ${CHURCH_REF_EMBED}`)
      .in("id", [...ids].sort()),
    getActiveExposure(),
  ]);
  if (error) throw new Error(`공고 조회 실패: ${error.message}`);
  return (data as unknown as CardRow[])
    .map(toEntry)
    .map((e) => toCard(e, today, activeTier(exposure, e.job.id)));
}

/** 운영자 관리 행 — 전체 상태·출처 + 교회 조인(**검수 상태를 안 본다**: 운영자는 전체를 본다) */
function toAdminRow(entry: CardEntry, today: string, exposure: ExposureMap): AdminJob {
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
    exposure: exposure.get(job.id) ?? null,
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
  const [entries, exposure] = await Promise.all([fetchAllCards(), getActiveExposure()]);
  return entries.map((e) => toAdminRow(e, today, exposure));
}

/**
 * 운영자 편집용 단건 — **행 그대로**(도메인 타입으로 옮기지 않는다).
 *
 * `getJobDetail`(공개 상세)과 나누는 이유: 저쪽은 화면이 쓰는 모양(`Job`)으로 옮기면서 만료·노출
 * 판정을 얹지만, 편집은 **DB 컬럼에 그대로 UPDATE를 걸어야** 해서 옮긴 값이 방해가 된다
 * (`lib/job-edits.ts`가 snake_case를 유지하는 것과 같은 이유).
 *
 * 캐시해도 안전하다 — 저장 액션이 `updateTag("jobs")`를 부르므로 고친 직후 다시 읽힌다.
 * 화면이 그리는 `posted_at`은 크롤러가 바꿀 수 있지만 편집 대상이 아니고, 저장은 액션이 최신 행을
 * 다시 읽어 비교한다(actions.ts).
 */
export async function getJobForEdit(id: string): Promise<Tables<"jobs"> | null> {
  "use cache";
  cacheTag("jobs", `job-${id}`);
  cacheLife("hours");

  const { data, error } = await createServiceClient()
    .from("jobs")
    .select(JOB_FULL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`공고 조회 실패: ${error.message}`);
  return data;
}

/** 운영자 홈의 공고 수치 — 공개 중 / 내려감. admin 홈 전용 */
export async function getAdminOverview(): Promise<AdminOverview> {
  "use cache";
  // 〃 — 요약 수치 둘 다 `jobs` 컬럼에서만 나온다
  cacheTag("jobs");
  cacheLife("hours");
  const today = todayInSeoul();
  // 수치 둘 다 만료 판정만 쓴다 — 운영자 행(`toAdminRow`)을 만들지 않고 판정 함수를 바로 부른다.
  // 두 수치가 짝이다 — "게재중(OPEN)"은 같은데 하나는 뜨고 하나는 안 뜬다. 그 차이를 만드는 것이
  // 만료 판정이라(`hiddenReason`) `status`만 세면 운영자가 부풀린 수치를 본다.
  const all = await fetchAllCards();
  return {
    visibleCount: all.filter((e) => isPubliclyOpen(e.job, today)).length,
    hiddenCount: all.filter((e) => hiddenReason(e.job, today) !== null).length,
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
 * about·pricing 커버리지 스탯 — 모집 중 공고 / 청빙 중인 교회 / 지역·교단 폭. **넷 다 공고(`jobs`) 기준**이다 —
 * 교회는 홈 `getJobStats`와 같은 키(`churchIdentityKey`), 지역·교단은 카드가 그리는 교회 참조에서 센다.
 *
 * ⚠️ 한때 교회·지역·교단을 `churches` 표(인증 교회)에서 셌다. 크롤 공고는 교회 행을 만들지 않으므로
 *    (가드레일 #1) 공고 921건 옆에 **"교회 1 · 지역 1 · 교단 1"**이 나갔고, 홈의 "청빙 중인 교회 794곳"과
 *    한 사이트 안에서 다른 말을 했다(2026-08-30 전수 점검). 인증 교회 수는 서비스 폭이 아니라 인증 진도다.
 * 미상(null)은 지역·교단 하나로 세지 않는다 — 그대로 두면 "교단 10개"처럼 조용히 +1 된다.
 */
export async function getCoverageStats(): Promise<{
  openCount: number;
  churchCount: number;
  regionCount: number;
  denominationCount: number;
}> {
  "use cache";
  // 카드의 교회 참조가 `churches` 조인을 읽는다(claim된 공고) — 교회 정보가 바뀌면 지역·교단도 바뀐다
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  const open = onlyOpen(await fetchOpenCards(), today);
  // 교회 참조만 쓴다 — 노출 등급은 이 수치와 무관해 원장을 읽지 않는다(`"NONE"`)
  const churches = open.map((e) => toCard(e, today, "NONE").church);

  return {
    openCount: open.length,
    churchCount: new Set(open.map((e) => churchIdentityKey(e.job))).size,
    regionCount: new Set(churches.map((c) => c.region).filter(Boolean)).size,
    denominationCount: new Set(churches.map((c) => c.denomination).filter(Boolean)).size,
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
 * 비슷한 공고 — 규칙은 `lib/similar-jobs`(순수)가, 후보 조회와 카드 변환은 여기가 한다.
 * 위 칸이 광고 자리라 `PlacedJob`으로 내려준다(광고가 없으면 전부 `ad=false`, 합은 늘 `limit` 이하).
 * 지역 매칭은 `jobs.region`으로 한다 — 조인 없이 도는 값이다(DATA §1 예외).
 */
export async function getSimilarJobs(id: string, limit = SIMILAR_JOBS_COUNT): Promise<PlacedJob[]> {
  "use cache";
  cacheTag("jobs", "churches");
  cacheLife("hours");
  const today = todayInSeoul();
  const [rawEntries, exposure] = await Promise.all([fetchOpenCards(), getActiveExposure()]);
  const entries = onlyOpen(rawEntries, today);

  // 기준 공고는 만료·마감됐어도 필요하다(마감 배너의 "비슷한 공고 보기") — 목록에서 못 찾으면 따로 읽는다
  const base = entries.find((e) => e.job.id === id)?.job ?? (await fetchCardFields(id));
  if (!base) return [];

  const byId = new Map(entries.map((e) => [e.job.id, e]));
  // 규칙(`lib/similar-jobs`)은 후보의 **오늘 등급**만 본다 — 광고 칸 자격이 거기서 갈린다
  const pick = pickSimilarJobs(
    { ...base, featuredTier: activeTier(exposure, base.id) },
    entries.map((e) => ({ ...e.job, featuredTier: activeTier(exposure, e.job.id) })),
    limit,
  );
  const place = (jobId: string, ad: boolean): PlacedJob => ({
    job: toCard(byId.get(jobId)!, today, activeTier(exposure, jobId)),
    ad,
  });
  return [
    ...pick.ads.map((c) => place(c.id, true)),
    ...pick.organic.map((c) => place(c.id, false)),
  ];
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
  const [{ data, error }, exposure] = await Promise.all([
    createServiceClient()
      .from("jobs")
      .select(`${JOB_CARD_COLUMNS}, ${CHURCH_REF_EMBED}`)
      .eq("church_id", churchId)
      .eq("status", VISIBLE_STATUS)
      .order("posted_at", { ascending: false }),
    getActiveExposure(),
  ]);
  if (error) throw new Error(`교회 공고 조회 실패: ${error.message}`);
  return onlyOpen((data as unknown as CardRow[]).map(toEntry), today)
    .filter((e) => e.job.id !== excludeId)
    .map((e) => toCard(e, today, activeTier(exposure, e.job.id)));
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
