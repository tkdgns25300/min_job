import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

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

export type CrawlRun = Pick<
  Tables<"crawl_run">,
  "started_at" | "finished_at" | "sources_ok" | "sources_failed" | "new_count"
>;

/**
 * 마지막 수집 실행 한 건 — 한 번도 안 돌았으면 `null`(새 환경·첫 배포).
 *
 * ⚠️ `finished_at`이 비어 있는 행은 **실패가 아니다** — 지금 돌고 있는 중일 수도 있고, 중단됐을
 *    수도 있다. 그 둘을 가르는 것이 위에서 말한 크롤러의 판정이므로 여기서는 값을 그대로 넘긴다.
 */
export async function getLastCrawlRun(): Promise<CrawlRun | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crawl_run")
    .select("started_at, finished_at, sources_ok, sources_failed, new_count")
    // 정렬 마지막 키를 못 박는다 — `started_at`은 크롤러 클라이언트가 써 넣는 값이라 동률이
    // 불가능하지 않고, 그러면 "마지막 실행"이 요청마다 바뀐다(검수 큐 정렬과 같은 이유).
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`수집 실행 조회 실패: ${error.message}`);
  return data;
}
