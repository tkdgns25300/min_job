import { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/types/database";

// 데이터 소스 seam (수집 실행) — 운영자 홈의 "마지막 수집" 한 줄이 유일한 소비자다.
//
// ⚠️ `crawl_run`은 **크롤러(min_job_agent) 소유 테이블**이다. `review_data`와 같은 관계로 **읽기만**
//    하고, 컬럼명도 snake_case를 유지해 크롤러 명세와 1:1로 대조된다.
// ⚠️ **캐시하지 않는다** — 크롤러는 우리 앱 밖에서 이 표에 쓰므로 무효화할 방법이 없고,
//    "마지막 수집이 언제인가"는 캐시된 답이 무의미한 질문이다. 그래서 `server.ts`(쿠키 세션)를 쓴다.
// ⛔ **경보 판정을 여기서 하지 않는다.** 죽었나(3시간)·연속 실패(2회)·빈 목록(2회) 판정은 크롤러의
//    `pipeline/health.py::alerts_for`가 정본이고 `minjob-ingest status`가 보여준다. 임계값을 여기에
//    한 벌 더 쓰면 언젠가 둘이 갈린다 — `isPubliclyOpen` 사본을 만들지 않는 것과 같은 이유다.
//    우리 화면은 **저장된 사실만** 그린다(언제 시작했나 · 끝났나 · 몇 곳이 됐나 · 몇 건이 새로 왔나).

export interface CrawlRun extends Pick<
  Tables<"crawl_run">,
  "started_at" | "finished_at" | "sources_ok" | "sources_failed" | "new_count"
> {
  /** 이번 실행에서 실패한 게시판(키 이름순) — 이름·주소는 화면이 `boardLabel`·`boardUrl`로 붙인다 */
  failed_sources: FailedSource[];
  /** 실행이 도중에 끊겼나 — 게시판 수치를 믿을 수 없다는 뜻이다(아래 주석) */
  aborted: boolean;
}

/** 실패한 게시판 하나 — `error`는 크롤러가 남긴 예외 문구 그대로다 */
export interface FailedSource {
  key: string;
  error: string;
}

/** 게시판이 아니라 **실행 자체가 끊긴 것** — 크롤러도 실패 게시판 수에서 뺀다(`cli.py`) */
const ABORTED_KEY = "_aborted";

/**
 * 실패한 게시판 — `error_detail`은 `{게시판키: 에러문구}` 꼴이다.
 *
 * 문구도 함께 넘긴다(2026-08-29 — 한때 키만 쓰고 버렸다). 길고 기술적이라(`ParseError: ... (1107593: ...)`)
 * 본문에 그리지는 않고, 화면이 링크의 `title`(마우스를 올리면 보이는 말)로만 붙인다. 자세한 것은
 * 여전히 `minjob-ingest status`가 보여준다.
 * ⚠️ `sources_failed`(개수)는 크롤러가 센 값을 그대로 쓴다 — `_aborted`가 섞이면 키 수와 갈린다.
 * ⚠️ **키 이름순으로 정렬한다.** jsonb는 키를 *길이 먼저* 정렬해 저장하므로 그대로 쓰면 짧은 키가 늘
 *    앞에 오고(`BU`·`CSU`), 크롤러 화면(`_print_errors`는 `sorted()`)과 **같은 실행을 다른 이름으로**
 *    부르게 된다. 화면이 둘 다 잘라 보여주므로(외 N) 순서가 곧 무엇을 보여줄지를 정한다.
 */
function failedSources(detail: Json): FailedSource[] {
  if (detail === null || typeof detail !== "object" || Array.isArray(detail)) return [];
  return Object.entries(detail)
    .filter(([key]) => key !== ABORTED_KEY)
    .map(([key, value]) => ({
      key,
      error: typeof value === "string" ? value : JSON.stringify(value),
    }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** 실행이 도중에 끊겼나 — 크롤러가 `_aborted` 키를 남긴다(`cli.py`의 `except BaseException`) */
function wasAborted(detail: Json): boolean {
  return detailKeys(detail).includes(ABORTED_KEY);
}

/** `error_detail`은 `jsonb NOT NULL DEFAULT '{}'`이지만 모양까지 보장되진 않아 좁혀서 읽는다 */
function detailKeys(detail: Json): string[] {
  if (detail === null || typeof detail !== "object" || Array.isArray(detail)) return [];
  return Object.keys(detail);
}

/**
 * 마지막 수집 실행 한 건 — 한 번도 안 돌았으면 `null`(새 환경·첫 배포).
 *
 * ⚠️ `finished_at`이 비어 있는 행은 **실패가 아니다** — 지금 돌고 있는 중일 수도 있고, 중단됐을
 *    수도 있다. 그 둘을 가르는 것이 위에서 말한 크롤러의 판정이므로 여기서는 값을 그대로 넘긴다.
 * ⚠️ **끊긴 실행은 `finished_at`이 채워진다** — 크롤러가 예외를 잡고 실행 기록을 닫기 때문이다.
 *    그때 `sources_ok`는 손대지 않은 게시판까지 세므로(`전체 - 실패`) 그 수치를 그대로 그리면
 *    3번째 게시판에서 죽은 실행이 "전부 성공"으로 나간다. 그래서 `aborted`를 따로 넘긴다.
 */
export async function getLastCrawlRun(): Promise<CrawlRun | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crawl_run")
    .select("started_at, finished_at, sources_ok, sources_failed, new_count, error_detail")
    // 정렬 마지막 키를 못 박는다 — `started_at`은 크롤러 클라이언트가 써 넣는 값이라 동률이
    // 불가능하지 않고, 그러면 "마지막 실행"이 요청마다 바뀐다(검수 큐 정렬과 같은 이유).
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`수집 실행 조회 실패: ${error.message}`);
  if (data === null) return null;
  const { error_detail, ...run } = data;
  return {
    ...run,
    failed_sources: failedSources(error_detail),
    aborted: wasAborted(error_detail),
  };
}
