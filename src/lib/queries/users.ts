import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CHURCH_VERIFICATION_STATUSES, DENOMINATIONS, REGIONS } from "@/constants/domain";
import { keyOf } from "@/lib/domain-enum";
import { claimMatchTier } from "@/lib/job-church";
import { exposureWindow, hiddenReason, isPubliclyOpen, todayInSeoul } from "@/lib/job-visibility";
import type { ExposureWindow, HiddenReason } from "@/lib/job-visibility";
import type { Church, CurrentUser, Job } from "@/types/domain";
import { fetchAllRows } from "./fetch-all";
import { JOB_CARD_COLUMNS, JOB_FULL_COLUMNS, toJob, toJobCardFields } from "./row-map";
import type { JobCardFields, JobCardRow } from "./row-map";

// 데이터 소스 seam (인증 사용자) — 인증 페이지는 여기서만 가져온다.
// ⚠️ 인증 의존 read는 **`'use cache'` 금지** — 쿠키 세션 기반 `server.ts`를 쓴다(`service.ts` X).
//    그래서 `todayInSeoul()`을 여기서 만들어도 캐시에 굳지 않는다(CLAUDE.md 제약 #2와 사정이 다르다).

// 마이페이지 관리 리스트 projection — 관리·표시에 필요한 필드만
export type MyJob = Pick<
  Job,
  | "id"
  | "title"
  | "status"
  | "postedAt"
  | "deadline"
  | "position"
  | "role"
  | "department"
  | "employmentType"
  | "source"
> & {
  /**
   * 공개 목록에 실제로 노출되는가 — 마감일 경과·상시모집 90일 초과면 false (DATA.md §6-1).
   * `status`는 교회의 명시적 의사표시(마감 버튼)라 별개다. 교회 화면은 둘 다 보여준다:
   * 숨겨진 공고에 노출 결제를 팔면 안 되고, 교회는 왜 안 보이는지 알아야 한다.
   */
  isPubliclyOpen: boolean;
  /** 내려간 이유 (안내 문구 선택용) — 노출 중이거나 교회가 직접 마감했으면 null */
  hiddenReason: HiddenReason;
  /** 유료 노출 창 — 노출 중이거나 시작을 기다리는 예약. 끝났거나 없으면 null(`exposureWindow`) */
  exposure: ExposureWindow | null;
};

// 교회 관리 대시보드 — 그 교회 공고(church_id 기준) + 클레임 가능(운영자 등록) 건수
export interface ChurchDashboard {
  church: Pick<Church, "name" | "denomination" | "region" | "city"> | null;
  // 교회 직접 등록 + 클레임으로 가져온 공고(둘 다 source=CHURCH) — 편집 대상.
  // 클레임 입구는 `/jobs/new`(등록 전 후보 패널) 한 곳이다 — 대시보드 상시 노출은 안 한다(운영자 2026-09-01)
  managed: MyJob[];
}

/**
 * 로그인 사용자 — Supabase Auth 세션 기준. 비로그인은 null(게이트가 /login으로 보낸다).
 * cache() = 요청 단위 메모이제이션: 한 요청에서 헤더와 페이지가 각각 불러도 Auth 왕복은 1회.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const supabase = await createClient();
    // getUser는 Auth 서버에서 토큰을 검증하고 최신 계정 정보를 준다(getSession과 달리 위조 불가).
    const { data, error } = await supabase.auth.getUser();
    // 이메일은 표시 신원(헤더 아바타·문의)이라 없으면 미로그인 취급 — CurrentUser.email은 non-null.
    if (error || !data.user?.email) {
      // 세션 없음(AuthSessionMissingError)은 정상 흐름이라 조용히 넘긴다.
      // 그 외(5xx·레이트리밋 등)는 로그인 사용자가 로그아웃된 것처럼 보이게 만드므로 원인을 남긴다.
      if (error && error.name !== "AuthSessionMissingError") {
        console.error("[auth] 세션 확인 실패 — 미로그인으로 처리", error);
      }
      return null;
    }

    // 신원(누구인가)은 `auth.users`, 소속·권한(무엇을 할 수 있나)은 `public.users` + `churches`.
    // `auth` 스키마는 PostgREST로 JOIN할 수 없어 프로필을 `public.users`에 복제해 둔다(DATA §3).
    // 행은 로그인 시 `auth/callback`이 만든다 — 세션이 있으면 이 행도 있다.
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select(
        "church_id, church_verification_status, verification_rejection_reason, churches(name, verification_status)",
      )
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      // 프로필을 못 읽으면 교회 권한을 **닫는 쪽**으로 강등한다(fail-closed) — 신원은 살아 있으니
      // 로그인 상태는 유지하고, 교회 기능만 잠긴다. 열어두면 미인증 교회가 공고를 올릴 수 있다.
      console.error("[auth] 프로필 조회 실패 — 교회 권한 없이 진행", profileError);
    }
    // enum 컬럼은 `text + CHECK`라 DB에서 `string`으로 온다(types/database.ts) — 여기서 좁힌다.
    // 아는 값이 아니면 null(미신청)로 본다 — 위 프로필 실패와 같은 fail-closed 방향.
    const status = profile?.church_verification_status;

    return {
      id: data.user.id,
      email: data.user.email,
      name: displayName(data.user.user_metadata),
      churchId: profile?.church_id ?? null,
      churchName: profile?.churches?.name ?? null,
      churchVerificationStatus: keyOf(CHURCH_VERIFICATION_STATUSES, status ?? null),
      // 사람과 교회 양쪽이 승인돼야 교회 기능이 열린다(`hasChurchAccess`) — 여기선 교회 쪽만 담는다.
      churchIsVerified: profile?.churches?.verification_status === "APPROVED",
      churchRejectionReason: profile?.verification_rejection_reason ?? null,
    };
  } catch (thrown) {
    // ⚠️ Next 내부 제어 신호(프리렌더 중단·dynamic bailout·redirect)는 반드시 되던진다.
    // 삼키면 dynamic hole이 "미로그인"으로 프리렌더에 박혀 캐시가 오염된다.
    unstable_rethrow(thrown);
    // 남는 건 진짜 장애(env 누락·네트워크). 헤더가 공개 페이지에서도 이 함수를 부르므로
    // 여기서 던지면 사이트 전체가 에러 화면이 된다 → 미로그인으로 강등(fail-closed).
    console.error("[auth] 세션 조회 실패 — 미로그인으로 처리", thrown);
    return null;
  }
});

/** OAuth 프로필의 표시명 — 제공자마다 키가 달라 후보를 순서대로 본다. 없으면 null(이메일로 폴백) */
function displayName(metadata: Record<string, unknown>): string | null {
  const candidates = [metadata.full_name, metadata.name];
  return candidates.find((v): v is string => typeof v === "string" && v.trim() !== "") ?? null;
}

/**
 * 교회 관리 대시보드 — 권한은 교회 인증 멤버십(DATA §4).
 * ⚠️ 이 함수는 `'use cache'`가 없다(인증 의존) → 여기서 오늘 날짜를 만들어도 굳지 않는다.
 *    공개 목록 쪽(`queries/jobs.ts`)은 cached scope라 사정이 다르다(CLAUDE.md 제약 #2).
 */
export async function getChurchDashboard(churchId: string): Promise<ChurchDashboard> {
  const today = todayInSeoul();
  const supabase = await createClient();
  const [church, jobs] = await Promise.all([
    supabase
      .from("churches")
      .select("name, denomination, region, city")
      .eq("id", churchId)
      .maybeSingle(),
    supabase
      .from("jobs")
      .select(JOB_CARD_COLUMNS)
      .eq("church_id", churchId)
      .order("posted_at", { ascending: false }),
  ]);
  if (church.error) throw new Error(`교회 조회 실패: ${church.error.message}`);
  if (jobs.error) throw new Error(`교회 공고 조회 실패: ${jobs.error.message}`);

  const rows = (jobs.data as unknown as JobCardRow[]).map(toJobCardFields);
  return {
    // 교회명·교단·지역은 **인증된 교회 행**에서 온다 — 공고 화면과 달리 여기는 교회 자기 정보다
    church: church.data
      ? {
          name: church.data.name,
          denomination: keyOf(DENOMINATIONS, church.data.denomination),
          region: keyOf(REGIONS, church.data.region),
          city: church.data.city,
        }
      : null,
    managed: rows.filter((j) => j.source === "CHURCH").map((j) => toMyJob(j, today)),
  };
}

/** 클레임 후보 한 건 — `/jobs/new` 등록 전 "이미 올라온 공고" 패널이 그린다 */
export interface ClaimCandidate {
  id: string;
  title: string;
  /**
   * **공고에 적힌 교회명** — 인증된 이름과 다를 수 있다(포함 매칭·교단 접두어·띄어쓰기).
   * 후보를 거는 그물은 느슨하고 **확정은 교회가 한다** — 그 판단의 핵심 근거가 이 이름이라,
   * 화면이 인증된 이름과 다를 때 보여 준다. 없으면 "태화교회" 공고를 "안동태화교회"가
   * 원문을 열어 보기 전에는 구분할 수 없다.
   */
  churchName: string;
  region: Job["region"];
  city: string | null;
  postedAt: string;
  sourceUrl: string | null;
}

/**
 * 클레임 후보 — 모집중·미배정(크롤) 공고 중 **이 인증 교회의 것일 수 있는 것**.
 * 규칙(어떤 공고를 후보로 거나)의 단일 소스는 `claimMatchTier`(lib/job-church)다 — 확실한
 * 순서(이름·지역 일치 → 지역 미상 → 이름 포함)로 정렬하고, 확정은 화면에서 교회가 한다.
 *
 * 인증 교회에 종속된 조회 + 가져간 즉시 목록에서 빠져야 하므로 캐시하지 않는다(`server.ts`).
 * ⚠️ 미배정 모집중 공고는 목표 규모가 1,000행을 넘는다 — `fetchAllRows`로 훑는다(CLAUDE 절단 함정).
 */
export async function getClaimCandidates(
  church: Pick<Church, "name" | "region" | "denomination">,
): Promise<ClaimCandidate[]> {
  const supabase = await createClient();
  const rows = await fetchAllRows<{
    id: string;
    title: string;
    church_name: string;
    region: string | null;
    city: string | null;
    denomination: string | null;
    posted_at: string;
    deadline: string | null;
    source_url: string | null;
  }>("클레임 후보", (from, to) =>
    supabase
      .from("jobs")
      .select(
        "id, title, church_name, region, city, denomination, posted_at, deadline, source_url",
        {
          count: "exact",
        },
      )
      .is("church_id", null)
      .eq("status", "OPEN")
      .order("id")
      .range(from, to),
  );

  const today = todayInSeoul();
  return rows
    .map((r) => {
      const region = keyOf(REGIONS, r.region);
      const tier = claimMatchTier(church, {
        churchName: r.church_name,
        region,
        denomination: keyOf(DENOMINATIONS, r.denomination),
      });
      return { r, region, tier };
    })
    .filter(({ r, tier }) => {
      if (tier === null) return false;
      // 목록에 실제로 보이는 공고만 — 숨은(만료) 공고를 가져가게 하면 중복 방지라는 목적과 무관하다
      return isPubliclyOpen({ status: "OPEN", postedAt: r.posted_at, deadline: r.deadline }, today);
    })
    .sort(
      (a, b) =>
        (a.tier as number) - (b.tier as number) || b.r.posted_at.localeCompare(a.r.posted_at),
    )
    .map(({ r, region }) => ({
      id: r.id,
      title: r.title,
      churchName: r.church_name,
      region,
      city: r.city,
      postedAt: r.posted_at,
      sourceUrl: r.source_url,
    }));
}

/** 마이페이지 관리 행 — 만료 판정을 붙여 내려보낸다(교회는 "왜 안 보이는지"를 알아야 한다) */
function toMyJob(job: JobCardFields, today: string): MyJob {
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    postedAt: job.postedAt,
    deadline: job.deadline,
    position: job.position,
    role: job.role,
    department: job.department,
    employmentType: job.employmentType,
    source: job.source,
    isPubliclyOpen: isPubliclyOpen(job, today),
    hiddenReason: hiddenReason(job, today),
    exposure: exposureWindow(job, today),
  };
}

/**
 * 수정 화면용 공고 — 권한 = 그 공고 church_id의 인증 관리자 **+ `source=CHURCH`**.
 * 운영자 등록 공고는 클레임 전까지 편집 불가(대시보드의 managed/claimable 구분과 일치).
 * 남의 교회 공고·미클레임 공고는 null → notFound
 */
export async function getEditableJob(id: string, churchId: string): Promise<Job | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_FULL_COLUMNS)
    .eq("id", id)
    .eq("church_id", churchId)
    // ⚠️ 권한 조건을 **쿼리에 건다** — 읽어와서 JS로 거르면 남의 공고를 한 번은 메모리에 올린다.
    //    `source=CHURCH`만 편집 대상이다(운영자 등록 공고는 클레임을 거쳐야 한다 · 대시보드와 같은 술어).
    .eq("source", "CHURCH")
    .maybeSingle();

  if (error) throw new Error(`수정 대상 공고 조회 실패: ${error.message}`);
  return data ? toJob(data) : null;
}
