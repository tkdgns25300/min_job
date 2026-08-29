"use server";

import { redirect } from "next/navigation";
import { RECENT_JOBS_MAX } from "@/lib/recent-jobs";
import { getJobCardsByIds } from "@/lib/queries/jobs";
import { getCurrentUser } from "@/lib/queries/users";
import { createClient } from "@/lib/supabase/server";
import type { BookmarkResult } from "@/components/job/bookmark-provider";
import type { JobCard } from "@/types/domain";

// 마이페이지의 mutation — 로그아웃 · 북마크. 북마크의 주인 화면이 `/mypage`(저장한 공고)라 여기 둔다.
// ⚠️ 저장 버튼은 공개 페이지(홈·목록·상세)에도 있어 **`(public)` 레이아웃이 이 파일을 import한다** —
//    `BookmarkProvider`에 `setBookmark`를 prop으로 넘긴다(`components/`가 `app/`을 import하지 않게).

/**
 * 로그아웃 — 세션 쿠키는 httpOnly라 서버에서만 해제할 수 있다.
 * scope: "local" = 이 브라우저만. 기본값(global)은 다른 기기 세션까지 끊어 사용자가 놀란다.
 */
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  // 만료된 토큰 등으로 해제가 실패하면 세션이 남을 수 있다 — 화면엔 안 드러나므로 로그로 남긴다.
  if (error) console.error("[auth] 로그아웃 실패", error);
  redirect("/");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Postgres foreign_key_violation — 저장하려는 공고가 그새 지워졌다
const FK_VIOLATION = "23503";

/**
 * 저장 / 저장 해제 — **목표 상태를 받는다**(토글이 아니다). 토글이면 두 번 빠르게 누를 때 두 요청이
 * 서로를 뒤집는다; 목표 상태면 마지막 요청이 이긴다. 같은 상태를 두 번 보내도 안전하다(멱등).
 *
 * ⚠️ `user_id`는 **세션에서만** 온다. RLS 유예 중이라(DATA §9) 이 조건이 유일한 방어선이다.
 * ⛔ `updateTag`을 부르지 않는다 — 북마크는 어디서도 캐시되지 않는다(`lib/queries/bookmarks.ts`).
 * ⚠️ 실패 문구는 **습니다체**다 — 아이콘 버튼엔 인라인 자리가 없어 토스트로 나가고, 토스트는 화면 불문
 *    습니다체다(CLAUDE.md Styling). 이 화면의 다른 액션 문구(해요체)와 다른 이유가 그것이다.
 */
export async function setBookmark(jobId: string, saved: boolean): Promise<BookmarkResult> {
  const user = await getCurrentUser();
  if (!user) return { kind: "login" };
  // `"preview"` 같은 값이 여기 오면 안 되지만(미리보기는 버튼을 끈다) 액션은 직접 호출될 수 있다
  if (!UUID.test(jobId)) return { kind: "error", message: "저장할 수 없는 공고입니다." };

  const supabase = await createClient();
  const row = { user_id: user.id, job_id: jobId };
  const { error } = saved
    ? await supabase
        .from("bookmarks")
        .upsert(row, { onConflict: "user_id,job_id", ignoreDuplicates: true })
    : await supabase.from("bookmarks").delete().match(row);

  if (error) {
    if (error.code === FK_VIOLATION) return { kind: "error", message: "이미 없는 공고입니다." };
    console.error("[bookmarks] 저장 실패", jobId, error);
    return { kind: "error", message: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  return { kind: "saved", saved };
}

/**
 * 최근 본 공고 카드 — id는 클라이언트 localStorage에 있어 **화면이 물어 와야 한다**. 데이터 조회용
 * route handler가 금지되어 있어(CLAUDE) Server Action이 규칙이 남긴 유일한 경로다(`lookupChurch`와 같다).
 * 로그인은 요구하지 않는다 — 공개 공고의 공개 카드다.
 *
 * ⚠️ 인자를 **여기서 거른다** — 조회 함수는 신뢰한 인자만 받는다. 상한은 저장 상한과 같다.
 * 결과 순서는 DB가 정하므로 호출부가 자기 순서(최근 본 순)로 다시 놓는다.
 */
export async function getRecentJobCards(ids: string[]): Promise<JobCard[]> {
  const valid = [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, RECENT_JOBS_MAX);
  if (valid.length === 0) return [];
  return getJobCardsByIds(valid);
}
