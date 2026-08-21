import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { POSTER_BUCKET, POSTER_URL_TTL_SECONDS } from "@/constants/review";
import {
  promotionGaps,
  reviewFlags,
  type FlagInput,
  type PromotionField,
  type ReviewFlag,
} from "@/lib/review-flags";
import type { Tables } from "@/types/database";

// 데이터 소스 seam (수집 검수) — `/admin/review**`만 쓴다.
//
// ⚠️ **`'use cache'`를 쓰지 않는다.** 미검수 데이터는 판정하는 순간 바뀌고, 운영자 전용이라
//    방문자마다 같은 뷰라는 전제가 없다. `server.ts`(쿠키 세션)로 읽어 dynamic을 유지한다.
// ⚠️ **컬럼명을 camelCase로 바꾸지 않는다** — 여기만 예외다(DATA §1 컨벤션의 예외).
//    `review_data`는 크롤러(min_job_agent) 소유 테이블이고 이 화면은 **그 테이블을 직접 편집하는
//    도구**다. 크롤러 명세가 전부 snake_case라 이름을 바꾸면 명세와 코드를 대조할 수 없고,
//    mutation이 `UPDATE review_data SET <컬럼>` 형태라 역매핑을 만들면 **CHECK 짝
//    (`denomination`↔`denomination_source` 등)이 깨지는 자리가 두 배**로 늘어난다.
// ⚠️ **`jobs`·`source_data`에 쓰지 않는다** — 공개는 크롤러가, 원문은 write-once다(SPEC).

/** 원문 쪽에서 검수가 실제로 쓰는 것만 */
export type ReviewSource = Pick<
  Tables<"source_data">,
  "raw_text" | "image_urls" | "attachments" | "title" | "posted_on" | "source_key" | "fetched_at"
>;

/** 큐 한 줄 — 목록이 그리는 것 + 배지 계산 결과 */
export interface ReviewRow {
  row: Tables<"review_data">;
  source: ReviewSource;
  flags: ReviewFlag[];
  /** 승격 필수 6칸 중 빈 것. 비어 있지 않으면 승인 버튼을 막는다 */
  gaps: PromotionField[];
}

/** 단건 — 큐 한 줄 + 포스터 signed URL */
export interface ReviewDetail extends ReviewRow {
  /** `poster_paths` 순서 그대로. 원문에 나온 순서라 지켜야 말이 된다(크롤러 SPEC §7.1) */
  posters: { path: string; url: string }[];
}

/** 큐 안의 앞뒤 건 — 링크를 만드는 규칙은 `reviewHref`(components/admin/review-row) 한 곳에 있다 */
export type QueueNeighbor = Pick<Tables<"review_data">, "id" | "dedup_state" | "dedup_key">;

/** 큐에서 이 건이 몇 번째인가 + 앞뒤. `position`이 0이면 큐에 없는 건(이미 처리됨) */
export interface QueueNavigation {
  position: number;
  total: number;
  prev: QueueNeighbor | null;
  next: QueueNeighbor | null;
}

// PostgREST embed — `source_data_id`에 UNIQUE가 걸려 1:1이라 배열이 아니라 객체로 온다.
const SELECT = `*, source_data!inner(raw_text, image_urls, attachments, title, posted_on, source_key, fetched_at)`;

type Joined = Tables<"review_data"> & { source_data: ReviewSource };

function toRow(joined: Joined): ReviewRow {
  const { source_data: source, ...row } = joined;
  const input: FlagInput = { ...row, imageCount: source.image_urls.length };
  const gaps = promotionGaps(input);
  return { row, source, flags: reviewFlags(input, gaps), gaps };
}

/**
 * 검수 큐 — ⚠️ **조건은 `review_status='PENDING'` 하나뿐이다**(크롤러 SPEC §3).
 *
 * `confidence`로 거르면 **양쪽으로** 어긋난다: 이단·마감으로 **이미 자동 거절된** 행이 딸려오고
 * (거절이 등급보다 앞선다), 중복 판정이 `UNCERTAIN`으로 돌린 행은 **등급이 `high`인데 `PENDING`**
 * 이라 놓친다. 등급은 "왜 여기 왔나"를 보여주는 데만 쓴다.
 *
 * 정렬은 `created_at` — `posted_at`은 중복 묶음의 최신 게시일로 **덮이는 파생값**이라 기준이 못 된다.
 * 인덱스가 이 쿼리 모양으로 있다(`review_data_queue_idx`).
 *
 * ⚠️ **상한이 있다.** 첫 수집 때 큐에 554건이 쌓일 수 있고(SPEC), 한 행에 원문 텍스트와 배열 다섯 개가
 *    달려 와 payload가 MB 단위가 된다. 오래된 것부터라 **먼저 처리할 것이 먼저 온다** — 큐를 굴리는 데
 *    지장이 없다. 배지에 쓸 **전체 수는 `getPendingCount()`** 가 따로 센다(`length`를 쓰면 100에서 멈춘다).
 */
const REVIEW_QUEUE_LIMIT = 100;

export async function getReviewQueue(limit = REVIEW_QUEUE_LIMIT): Promise<ReviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_data")
    .select(SELECT)
    .eq("review_status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`검수 큐 조회 실패: ${error.message}`);
  return (data as Joined[]).map(toRow);
}

/**
 * 처리한 것 — 되돌리기·감사용. 최근 처리 순.
 * ⚠️ 잘린 목록이므로 **건수 배지에 `length`를 쓰지 말 것** — 100에서 멈춰 거짓말한다.
 *    개수는 `getReviewDoneCount()`가 따로 센다.
 */
const REVIEW_DONE_LIMIT = 100;

export async function getReviewDone(limit = REVIEW_DONE_LIMIT): Promise<ReviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_data")
    .select(SELECT)
    .neq("review_status", "PENDING")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(`처리 목록 조회 실패: ${error.message}`);
  return (data as Joined[]).map(toRow);
}

/** 처리한 것의 실제 개수 — 목록은 잘려 오므로 배지는 이 값을 쓴다 */
export async function getReviewDoneCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("review_data")
    .select("id", { count: "exact", head: true })
    .neq("review_status", "PENDING");

  if (error) throw new Error(`처리 건수 조회 실패: ${error.message}`);
  return count ?? 0;
}

/** 큐 크기 — 화면 상단의 "남은 것". 끝이 보이지 않으면 손을 못 댄다(SPEC §4.5) */
export async function getPendingCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("review_data")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "PENDING");

  if (error) throw new Error(`큐 크기 조회 실패: ${error.message}`);
  return count ?? 0;
}

/**
 * 오늘 **판정한** 수 — 사람이 손댄 것(`reviewed_by` 있음) 중 큐를 떠난 것.
 * ⚠️ `reviewed_by`만으로 세면 **저장만 한 건이 섞인다** — 저장도 도장을 찍기 때문이다
 *    (그 칸이 "사람이 손댔다"의 정본이라 저장에서도 찍어야 한다 · actions.ts).
 */
export async function getReviewedTodayCount(todayKst: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("review_data")
    .select("id", { count: "exact", head: true })
    .not("reviewed_by", "is", null)
    .neq("review_status", "PENDING")
    .gte("reviewed_at", `${todayKst}T00:00:00+09:00`);

  if (error) throw new Error(`처리 건수 조회 실패: ${error.message}`);
  return count ?? 0;
}

/** 단건 — 없으면 null(호출부가 notFound). 포스터는 비공개 버킷이라 signed URL을 만들어 준다 */
export async function getReviewDetail(id: string): Promise<ReviewDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_data")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`검수 항목 조회 실패: ${error.message}`);
  if (!data) return null;

  const base = toRow(data as Joined);
  return { ...base, posters: await signPosters(base.row.poster_paths) };
}

/**
 * 저장된 행 하나 — **Server Action 전용**(판정 직전 확인). 화면을 연 뒤 크롤러나 다른 창이
 * 이미 처리했을 수 있고, 교단 판정 근거는 원래 값과 대조해야 정할 수 있다(lib/review-edits).
 * 포스터를 서명하지 않는 것이 `getReviewDetail`과의 차이다 — 액션은 그림이 필요 없다.
 */
export async function getReviewRow(id: string): Promise<Tables<"review_data"> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("review_data").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(`검수 항목 조회 실패: ${error.message}`);
  return data;
}

/**
 * 큐 안의 위치와 앞뒤 건 — "몇 건 남았나"가 보이면 손을 댄다(크롤러 SPEC §4.5).
 * 정렬은 큐와 **같아야** 한다(`created_at`) — 다르면 "다음"이 목록 순서와 어긋난다.
 */
export async function getQueueNavigation(id: string): Promise<QueueNavigation> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_data")
    .select("id, dedup_state, dedup_key")
    .eq("review_status", "PENDING")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`큐 순서 조회 실패: ${error.message}`);

  const index = data.findIndex((r) => r.id === id);
  return {
    // 처리된 건을 열면 큐에 없다 — 그때는 위치를 말하지 않는다(0)
    position: index + 1,
    total: data.length,
    prev: index > 0 ? data[index - 1] : null,
    next: index >= 0 && index < data.length - 1 ? data[index + 1] : null,
  };
}

/**
 * 같은 자리 묶음 — `dedup_state='UNCERTAIN'`인 건을 판단하려면 묶음을 나란히 놓아야 한다.
 *
 * ⚠️ **정렬·표시 날짜는 `source_data.posted_on`이다 — `review_data.posted_at`이 아니다.**
 *    후자는 묶음의 최신 게시일로 **덮이는 파생값**이라 구성원끼리 같은 값이 되고, 그러면
 *    "어느 것이 먼저 올라왔나"라는 이 화면의 핵심 근거가 사라진다. `posted_on`은 원문 테이블의
 *    write-once 값이라 게시판에 실제로 올라온 날 그대로다.
 * ⚠️ 정렬을 JS에서 하는 이유: 묶음은 2~5건이라 비용이 없고, PostgREST의 embed 정렬은
 *    조인 형태에 따라 무시될 수 있어 "정렬했다고 믿는데 안 된" 상태가 조용히 생긴다.
 *
 * ⚠️ **판정 대상이 아닌 구성원도 함께 온다**(이미 공개된 대표, 중복으로 거절된 것). 화면은 그것을
 *    보여만 주고 **쓰지 않는다** — 공개된 공고를 내리는 일은 `jobs`를 쓰는 일이다(SPEC).
 */
export async function getReviewGroup(dedupKey: string): Promise<ReviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_data")
    .select(SELECT)
    .eq("dedup_key", dedupKey);

  if (error) throw new Error(`묶음 조회 실패: ${error.message}`);
  return (data as Joined[])
    .map(toRow)
    .sort((a, b) => a.source.posted_on.localeCompare(b.source.posted_on));
}

/**
 * 포스터 경로 → signed URL. 비공개 버킷이라 **경로를 그대로 `<img src>`에 넣으면 안 된다**.
 * 만료가 있으므로 요청마다 만든다(그래서 이 화면은 캐시하지 않는다).
 *
 * ⚠️ **여기만 `service.ts`를 쓴다** — `storage.objects`는 RLS가 항상 켜져 있고 `postings` 버킷엔
 *    정책이 없어(RLS 유예) publishable 키로는 서명이 **실패**한다. 정책을 만들면 로그인한 아무나
 *    포스터를 읽게 되고, 운영자만 허용하려면 판정 로직(`.env ADMIN_EMAILS`)을 DB에 넣어야 해
 *    "DB는 저장 전용" 원칙과 부딪힌다. 이 호출은 `requireOperator()` 뒤에서만 일어나고,
 *    돌려주는 것은 개체 하나에 묶인 30분짜리 URL이라 시크릿이 새지 않는다.
 *
 * 실패한 항목은 건너뛴다 — 한 장이 안 되는 것보다 화면이 통째로 죽는 게 나쁘다.
 */
async function signPosters(paths: string[]): Promise<{ path: string; url: string }[]> {
  if (paths.length === 0) return [];
  const { data, error } = await createServiceClient()
    .storage.from(POSTER_BUCKET)
    .createSignedUrls(paths, POSTER_URL_TTL_SECONDS);

  if (error) {
    console.error("[review] 포스터 서명 실패 — 원문 링크로 안내한다", error);
    return [];
  }
  return data
    .filter((d): d is typeof d & { signedUrl: string } => Boolean(d.signedUrl))
    .map((d) => ({ path: d.path ?? "", url: d.signedUrl }));
}
