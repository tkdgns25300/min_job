import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "./fetch-all";
import { createServiceClient } from "@/lib/supabase/service";
import {
  POSTER_BUCKET,
  POSTER_URL_TTL_SECONDS,
  READABLE_ATTACHMENT_EXTENSIONS,
  SOURCE_FORM_FIELDS,
} from "@/constants/review";
import {
  promotionGaps,
  reviewAttention,
  type Attention,
  type AttentionInput,
  type PromotionField,
} from "@/lib/review-flags";
import type { Json, Tables } from "@/types/database";
import type { QueueSummary } from "@/types/domain";

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

/**
 * 목록이 쓰는 원문 조각 — **딱 그리는 것만**.
 *
 * ⚠️ `raw_text`·`attachments`를 넣지 않는다. 판정(`reviewAttention`)에 길이·개수가 필요해서 **DB에서
 *    읽기는** 하지만, 그 원문을 목록 타입에 담으면 큐 100건 × 원문 수 KB가 **클라이언트 payload로
 *    직렬화**된다(목록 뷰가 client 컴포넌트다). 세고 버린다.
 */
type ReviewSourceRef = Pick<Tables<"source_data">, "posted_on" | "source_key" | "fetched_at">;

/** 단건 원문 열이 쓰는 것 — 여기가 "원문 전부"다(본문·제목·게시판 양식 값·첨부·그림 수) */
interface ReviewSourceDetail extends ReviewSourceRef {
  /** 게시판 글 제목 — AI가 다듬은 `review_data.title`과 **다를 수 있다**(모델이 만들 수 없는 두 번째 출처) */
  title: string;
  raw_text: string;
  /** 게시판에 있던 그림 수 — 받은 파일(`poster_paths`)과 다르면 못 받은 것이다 */
  imageCount: number;
  /** 게시판이 양식으로 받아 둔 **공고 내용**(`raw_meta` 중 `SOURCE_FORM_FIELDS`만) */
  form: SourceFormValue[];
}

/** 게시판 양식 한 줄 */
export interface SourceFormValue {
  label: string;
  value: string;
}

/**
 * 포스터 한 장. **`poster_paths`에 이미지만 오는 게 아니다** — 크롤러는 **PDF도 같은 배열에** 담는다
 * (크롤러 SPEC §7.1 · 실측 2026-08-23: jpg 75 · png 10 · **pdf 1**). `<img>`로 그리면 PDF가
 * 깨진 그림 아이콘으로 나온다 → 종류를 여기서 정해 화면이 골라 그리게 한다.
 *
 * ⚠️ `other`를 둔 이유: 확장자가 늘면(hwp 등) 다시 깨진 그림이 되는 대신 **링크로 떨어진다.**
 */
export interface ReviewPoster {
  path: string;
  url: string;
  kind: "image" | "pdf" | "other";
}

/**
 * 첨부 한 줄 — `source_data.attachments`(`[{name, url}]`)를 화면이 쓸 모양으로.
 *
 * `count`가 있는 이유: 게시판이 **같은 파일을 여러 줄로 낸다**(실측 — 지원서 하나가 9줄, 같은
 * hwp가 2줄). 그대로 그리면 "첨부 9개"가 되어 정작 읽을 것이 화면에서 밀려난다.
 */
export interface ReviewAttachment {
  name: string;
  url: string;
  /** 같은 이름으로 몇 줄 왔나 */
  count: number;
  /** 구조화가 내용을 읽었을 수 있는 형식인가(이미지) */
  readable: boolean;
}

/** 큐 한 줄 — 목록이 그리는 것 + 판정 결과 */
export interface ReviewRow {
  row: Tables<"review_data">;
  source: ReviewSourceRef;
  /** 확인할 것 — 목록의 필터·단건 화면의 머리글이 같은 판정을 쓴다(lib/review-flags) */
  attention: Attention[];
  /** 승격 필수 6칸 중 빈 것. 비어 있지 않으면 승인 버튼을 막는다 */
  gaps: PromotionField[];
}

/** 단건 — 큐 한 줄 + 원문 전부 + 포스터 signed URL */
export interface ReviewDetail extends ReviewRow {
  source: ReviewSourceDetail;
  /** 이름으로 합친 첨부 목록 */
  attachments: ReviewAttachment[];
  /** `poster_paths` 순서 그대로. 원문에 나온 순서라 지켜야 말이 된다(크롤러 SPEC §7.1) */
  posters: ReviewPoster[];
}

/** 큐 안의 앞뒤 건 — 링크를 만드는 규칙은 `reviewHref`(app/admin/review/review-row) 한 곳에 있다 */
export type QueueNeighbor = Pick<Tables<"review_data">, "id" | "dedup_state" | "dedup_key">;

/** 큐에서 이 건이 몇 번째인가 + 앞뒤. `position`이 0이면 큐에 없는 건(이미 처리됨) */
export interface QueueNavigation {
  position: number;
  total: number;
  prev: QueueNeighbor | null;
  next: QueueNeighbor | null;
}

// PostgREST embed — `source_data_id`에 UNIQUE가 걸려 1:1이라 배열이 아니라 객체로 온다.
// 목록도 판정에 원문 길이·첨부 수가 필요해 그 컬럼을 **읽기는** 한다(담아 보내지는 않는다).
const SOURCE_COLUMNS = "raw_text, image_urls, attachments, posted_on, source_key, fetched_at";
const LIST_SELECT = `*, source_data!inner(${SOURCE_COLUMNS})`;
const DETAIL_SELECT = `*, source_data!inner(${SOURCE_COLUMNS}, title, raw_meta)`;

type JoinedSource = ReviewSourceRef & {
  raw_text: string;
  image_urls: string[];
  attachments: Json;
};
type Joined = Tables<"review_data"> & { source_data: JoinedSource };
type JoinedDetail = Tables<"review_data"> & {
  source_data: JoinedSource & {
    title: string;
    raw_meta: Json;
    last_structure_error: string | null;
  };
};

/** 판정에 필요한 원문 요약 — 원문 자체는 목록으로 나가지 않는다(`ReviewSourceRef` 주석) */
function attentionInput(
  row: Tables<"review_data">,
  source: JoinedSource,
): { input: AttentionInput; attachments: ReviewAttachment[] } {
  const attachments = parseAttachments(source.attachments);
  return {
    attachments,
    input: {
      ...row,
      imageCount: source.image_urls.length,
      rawTextLength: source.raw_text.trim().length,
      unreadFiles: attachments.filter((file) => !file.readable).length,
      imagePosters: row.poster_paths.filter((path) => posterKind(path) === "image").length,
    },
  };
}

function toRow(joined: Joined): ReviewRow {
  const { source_data: joinedSource, ...row } = joined;
  const { posted_on, source_key, fetched_at } = joinedSource;
  const { input } = attentionInput(row, joinedSource);
  const gaps = promotionGaps(input);
  return {
    row,
    source: { posted_on, source_key, fetched_at },
    attention: reviewAttention(input, gaps),
    gaps,
  };
}

/**
 * `jsonb` → 첨부 목록. **이름이 같은 것을 합친다**(위 `count` 주석).
 *
 * 크롤러 소유 컬럼이라 모양을 우리가 보장할 수 없다 — `{name, url}`이 아닌 원소는 조용히 버린다.
 * 첨부 목록이 깨졌다고 검수 화면이 죽는 것보다, 목록이 짧은 채로 원문 링크를 주는 게 낫다.
 */
function parseAttachments(value: Json): ReviewAttachment[] {
  if (!Array.isArray(value)) return [];
  const byName = new Map<string, ReviewAttachment>();

  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const { name, url } = item as { name?: unknown; url?: unknown };
    if (typeof name !== "string" || typeof url !== "string" || !name || !url) continue;

    const seen = byName.get(name);
    if (seen) {
      seen.count += 1;
      continue;
    }
    byName.set(name, { name, url, count: 1, readable: isReadable(name) });
  }
  return [...byName.values()];
}

/** 확장자로만 판단한다 — 이름으로 "공고문/지원 양식"을 가르지 않는 이유는 constants/review에 적었다 */
function isReadable(name: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return READABLE_ATTACHMENT_EXTENSIONS.some((allowed) => allowed === extension);
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
 * ⚠️ **상한이 있다.** 첫 수집 때 큐에 554건이 쌓일 수 있고(SPEC), 판정에 원문 길이·첨부 수가 필요해
 *    **한 행마다 원문 텍스트와 배열 다섯 개를 DB에서 읽는다**(화면으로 나가지는 않는다 ·
 *    `ReviewSourceRef`). 오래된 것부터라 **먼저 처리할 것이 먼저 온다** — 큐를 굴리는 데 지장이 없다.
 *    탭에 쓸 **전체 수는 `getPendingSummary()`** 가 따로 센다(`length`를 쓰면 100에서 멈춘다).
 */
const REVIEW_QUEUE_LIMIT = 100;

export async function getReviewQueue(limit = REVIEW_QUEUE_LIMIT): Promise<ReviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_data")
    .select(LIST_SELECT)
    .eq("review_status", "PENDING")
    .order("created_at", { ascending: true })
    // ⚠️ `id` 타이브레이크는 **`getQueueNavigation`과 짝**이다. `created_at`이 같은 행이 생기면
    //    (크롤러가 한 트랜잭션으로 묶어 넣으면 `now()`가 고정돼 전부 같아진다) 정렬이 갈리고,
    //    그러면 단건 화면의 "다음"이 목록의 다음 줄과 어긋난다.
    .order("id")
    .limit(limit);

  if (error) throw new Error(`검수 큐 조회 실패: ${error.message}`);
  return (data as Joined[]).map(toRow);
}

/**
 * 처리한 것 — 되돌리기·감사용. 최근 처리 순.
 * ⚠️ 잘린 목록이므로 **탭 건수에 `length`를 쓰지 말 것** — 100에서 멈춰 거짓말한다.
 *    개수는 `getReviewDoneCount()`가 따로 센다.
 */
const REVIEW_DONE_LIMIT = 100;

export async function getReviewDone(limit = REVIEW_DONE_LIMIT): Promise<ReviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_data")
    .select(LIST_SELECT)
    .neq("review_status", "PENDING")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    // 100건 상한이 있어 경계에서 행이 오갈 수 있다 — 유일 키로 순서를 못 박는다
    .order("id")
    .limit(limit);

  if (error) throw new Error(`처리 목록 조회 실패: ${error.message}`);
  return (data as Joined[]).map(toRow);
}

/** 처리한 것의 실제 개수 — 목록은 잘려 오므로 탭은 이 값을 쓴다 */
export async function getReviewDoneCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("review_data")
    .select("id", { count: "exact", head: true })
    .neq("review_status", "PENDING");

  if (error) throw new Error(`처리 건수 조회 실패: ${error.message}`);
  return count ?? 0;
}

/**
 * 큐 크기 + 가장 오래 기다린 건 — 검수 화면 상단의 "남은 것"(끝이 보이지 않으면 손을 못 댄다 ·
 * SPEC §4.5)과 운영자 홈의 적체 신호가 **같은 한 번의 조회**를 쓴다.
 *
 * ⚠️ 정렬 마지막 키를 `id`로 못 박는다 — 크롤러가 한 트랜잭션으로 넣으면 `created_at`이 같아지고
 *    (`now()`가 고정된다) 그러면 "가장 오래된 건"이 요청마다 바뀐다. 큐 목록의 정렬 규칙과 같다.
 */
export async function getPendingSummary(): Promise<QueueSummary> {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("review_data")
    .select("created_at", { count: "exact" })
    .eq("review_status", "PENDING")
    .order("created_at")
    .order("id")
    .limit(1);

  if (error) throw new Error(`큐 크기 조회 실패: ${error.message}`);
  return { count: count ?? 0, oldestAt: data[0]?.created_at ?? null };
}

/**
 * 승인했지만 아직 공개되지 않은 건 — **승인이 조용히 증발하는 유일한 경로**다.
 *
 * 검수 승인은 `review_status`만 바꾸고 `jobs` 공개는 **크롤러의 다음 실행**이 한다
 * (중복 판정이 끝난 뒤에만 안전하므로 · min_job_agent SPEC §4.3). 크롤러가 멈춰 있으면 여기 쌓이고,
 * 그 사실을 아무도 말해 주지 않으면 승인한 공고가 영영 올라오지 않는다.
 */
export async function getPublishBacklogCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("review_data")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "APPROVED")
    .is("published_job_id", null);

  if (error) throw new Error(`공개 대기 조회 실패: ${error.message}`);
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
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`검수 항목 조회 실패: ${error.message}`);
  if (!data) return null;

  const { source_data: joinedSource, ...row } = data as JoinedDetail;
  const { input, attachments } = attentionInput(row, joinedSource);
  const gaps = promotionGaps(input);

  return {
    row,
    source: {
      posted_on: joinedSource.posted_on,
      source_key: joinedSource.source_key,
      fetched_at: joinedSource.fetched_at,
      title: joinedSource.title,
      raw_text: joinedSource.raw_text,
      imageCount: joinedSource.image_urls.length,
      form: parseForm(joinedSource.raw_meta),
    },
    attachments,
    attention: reviewAttention(input, gaps),
    gaps,
    posters: await signPosters(row.poster_paths),
  };
}

/**
 * `raw_meta` → 게시판 양식 값. **공고 내용인 키만** 낸다(`SOURCE_FORM_FIELDS` — 게시판 배관을
 * 뺀 이유는 그 상수 주석에). 값이 빈 키는 줄째 사라진다.
 */
function parseForm(value: Json): SourceFormValue[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  const source = value as Record<string, Json>;
  return SOURCE_FORM_FIELDS.map(({ key, label }) => ({
    label,
    value: typeof source[key] === "string" ? (source[key] as string).trim() : "",
  })).filter((entry) => entry.value !== "");
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
  // 큐 전체를 훑는다 — 1,000행 상한에 닿으면 "n / m"이 조용히 틀린 수가 된다(fetch-all)
  const data = await fetchAllRows<QueueNeighbor>("큐 순서", (from, to) =>
    supabase
      .from("review_data")
      .select("id, dedup_state, dedup_key", { count: "exact" })
      .eq("review_status", "PENDING")
      .order("created_at", { ascending: true })
      .order("id")
      .range(from, to),
  );

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
    .select(LIST_SELECT)
    .eq("dedup_key", dedupKey);

  if (error) throw new Error(`묶음 조회 실패: ${error.message}`);
  return (
    (data as Joined[])
      .map(toRow)
      // 같은 날 올라온 구성원이 있으면 `posted_on`만으로는 순서가 정해지지 않는다 — 줄 번호가
      // 새로 고칠 때마다 바뀌지 않게 유일 키로 못 박는다
      .sort(
        (a, b) =>
          a.source.posted_on.localeCompare(b.source.posted_on) || a.row.id.localeCompare(b.row.id),
      )
  );
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
async function signPosters(paths: string[]): Promise<ReviewPoster[]> {
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
    .map((d) => ({ path: d.path ?? "", url: d.signedUrl, kind: posterKind(d.path ?? "") }));
}

/** 확장자로만 판단한다 — Storage는 content-type을 되돌려주지 않고, 경로에 확장자가 항상 있다 */
function posterKind(path: string): ReviewPoster["kind"] {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return "pdf";
  return READABLE_ATTACHMENT_EXTENSIONS.some((allowed) => allowed === extension)
    ? "image"
    : "other";
}
