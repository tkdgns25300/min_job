import { createClient } from "@/lib/supabase/server";
import { todayInSeoul } from "@/lib/job-visibility";
import type { JobCard } from "@/types/domain";
import { CHURCH_REF_EMBED, JOB_CARD_COLUMNS, toCard, toEntry, type CardRow } from "./row-map";

// 데이터 소스 seam (북마크) — 로그인 사용자의 저장한 공고. 마이페이지·헤더 seed가 여기서만 가져온다.
//
// ⚠️ **인증 의존 read라 `'use cache'` 금지** — `users.ts`와 같은 예외. 사용자마다 결과가 다르고,
//    캐시하면 저장을 눌러도 목록이 한 시간 옛것으로 남는다. 쿠키 세션 기반 `server.ts`를 쓴다.
// ⚠️ **`userId`는 세션에서만 온다**(`requireUser`·`getCurrentUser`). RLS는 유예 중이라(DATA §9)
//    `eq("user_id", …)` 조건이 유일한 방어선이다 — 클라이언트가 보낸 값을 여기로 흘리지 않는다.
//    RLS를 켜면 정책도 "본인만"이라 이 쿼리는 그대로 맞는다.
// ⚠️ **조인에 `!inner`를 쓰지 않는다** — 교회는 크롤 공고에서 NULL이 정상이다(가드레일 #1). 공고 쪽은
//    FK `ON DELETE CASCADE`라 북마크가 가리키는 공고는 항상 있다.

/** 저장한 공고 id — 공개 페이지의 저장 버튼이 "채워졌나"를 판정하는 데 쓴다(순서 무관) */
export async function getBookmarkIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("bookmarks").select("job_id").eq("user_id", userId);
  if (error) throw new Error(`북마크 조회 실패: ${error.message}`);
  return data.map((row) => row.job_id);
}

/**
 * 저장한 공고 카드 — 최근에 저장한 것부터. **마감·만료된 공고도 포함**한다(카드의 `isPubliclyOpen`으로
 * "마감" 표시) — 저장한 것이 조용히 사라지면 안 된다.
 */
export async function getBookmarkedJobCards(userId: string): Promise<JobCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookmarks")
    .select(`created_at, jobs(${JOB_CARD_COLUMNS}, ${CHURCH_REF_EMBED})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`저장한 공고 조회 실패: ${error.message}`);

  // 요청 스코프라 `new Date()`가 굳지 않는다 — `users.ts`와 같은 사정
  const today = todayInSeoul();
  // 중첩 embed는 PostgREST 타입 파서가 못 읽어 행 모양을 직접 준다(`jobs.ts`의 `CardRow` 캐스트와 같은 관용구)
  const rows = data as unknown as { jobs: CardRow | null }[];
  // FK가 보장하지만 타입은 nullable — 없으면 건너뛴다(빈 행을 그리지 않는다)
  // 노출 등급은 `"NONE"`이다 — 저장한 공고 목록엔 광고 자리가 없어(라벨은 자리의 속성) 원장을 읽지 않는다
  return rows.flatMap((row) => (row.jobs ? [toCard(toEntry(row.jobs), today, "NONE")] : []));
}
