"use server";

import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth-guard";
import { hasChurchAccess } from "@/lib/auth";
import {
  infoErrors,
  toChannelRows,
  toChurchUpdate,
  type ChurchInfoDraft,
  type InfoErrors,
} from "@/lib/church-info";
import { createClient } from "@/lib/supabase/server";

// 인증 교회가 자기 정보를 고치는 mutation — **`churches` + `church_links` 두 표만** 쓴다.
//
// ⚠️ **`church_id`를 클라이언트에서 받지 않는다.** 세션의 인증 교회로 강제한다 — 받으면 남의
//    교회 정보를 고칠 수 있다(공고 등록과 같은 결).
// ⛔ **공고를 건드리지 않는다.** 공고는 등록 시점의 교회 값을 복사해 갖고 그것이 정본이다
//    (근거는 `lib/church-info.ts` 머리말).
// ⛔ **사진(`church_photos`)은 이 액션의 범위가 아니다** — 공개 버킷 설계·업로드 권한이 성질이
//    달라 따로 푼다(ROADMAP).
// ⚠️ **트랜잭션이 없다.** PostgREST는 여러 문장을 한 트랜잭션으로 묶지 못하고, DB 함수를 만드는
//    것은 "DB는 저장 전용"이 막는다(CLAUDE DB Policy). 그래서 **순서로 피해를 줄인다** — 아래 참조.

/** 실패·성공 둘 다 말이 필요하다 — `redirect`하지 않고 이 화면에 머문다 */
export type InfoActionResult = { message?: string; errors?: InfoErrors; saved?: true };

const NEED_CHURCH = "교회 인증이 필요해요.";
const GONE = "교회 정보를 찾지 못했어요. 새로 불러 주세요.";
const SAVE_FAILED = "저장하지 못했어요. 적은 내용은 그대로 있으니 잠시 후 다시 시도해 주세요.";
/**
 * 채널 쓰기는 **두 단계**라 실패도 두 가지다 — 한 문구로 뭉치면 거짓이 된다.
 * · `save`    넣기가 실패 → 채널이 저장되지 않았다
 * · `cleanup` 넣기는 됐고 **지우기**가 실패 → 적은 것은 다 저장됐고, **비운 채널이 아직 남아 있다**
 *   (이때 "저장하지 못했어요"라고 하면 저장된 것을 안 저장됐다고 말하는 셈이다)
 *
 * ⚠️ **화면에서는 부분 실패도 실패와 같은 모양이다**(빨간 인라인 · `role="alert"`). 색을 따로 두는
 *    안을 검토했지만 세 갈래 모두 **다음에 할 일이 같다**(다시 저장) — 행동이 같은 것을 색으로
 *    나누면 신호만 늘고 판단은 안 바뀐다. 어디까지 됐는지는 위 문구가 말한다(4초 토스트가 아니라
 *    인라인이라 읽을 시간이 있다).
 */
const LINK_FAILURE = {
  save: "기본 정보는 저장됐지만 채널을 저장하지 못했어요. 채널만 다시 저장해 주세요.",
  cleanup: "저장은 됐는데, 비워 둔 채널이 교회 페이지에 아직 남아 있어요. 한 번 더 저장해 주세요.",
} as const;

/**
 * 저장 — 성공하면 이 화면에 머문다(`updateTag`이 값을 새로 읽게 만든다 · `setJobStatus`와 같은 결).
 * 대시보드로 튀면 방금 고친 것을 확인하러 되돌아와야 한다.
 */
export async function saveChurchInfo(draft: ChurchInfoDraft): Promise<InfoActionResult> {
  const user = await requireUser();
  // 게이트를 **여기서 다시 본다** — 액션은 직접 호출될 수 있고 신뢰 경계는 서버다(2단 방어).
  // `hasChurchAccess`는 사람·교회 양쪽이 APPROVED인지 보고, 교회 쪽은 캐시가 아닌 실 조인에서 온다
  // → 그 사이 인증이 내려갔으면 여기서 막힌다.
  if (!hasChurchAccess(user) || user.churchId === null) return { message: NEED_CHURCH };

  const errors = infoErrors(draft);
  if (Object.keys(errors).length > 0) return { errors };

  const supabase = await createClient();

  const saved = await supabase
    .from("churches")
    .update(toChurchUpdate(draft))
    .eq("id", user.churchId)
    // 게이트를 지났어도 조건을 걸어 둔다 — 그 사이 인증이 내려갔으면 고치지 않는다
    .eq("verification_status", "APPROVED")
    .select("id");
  if (saved.error) {
    console.error("[church-info] 기본 정보 저장 실패", saved.error);
    return { message: SAVE_FAILED };
  }
  // 0행 UPDATE는 PostgREST에서 성공으로 온다 — 조건에 걸린 것이지 저장된 것이 아니다
  if (saved.data.length === 0) return { message: GONE };

  const linkFailure = await saveChannels(supabase, user.churchId, draft);

  // ⚠️ **실패해도 무효화한다.** 기본 정보는 이미 저장됐으므로, 캐시를 두면 교회 상세가 한 시간
  //    동안 옛 값을 내보낸다 — "실패했다"고 말해 놓고 화면은 안 바뀌는 상태가 된다.
  updateTag("churches");

  return linkFailure ? { message: LINK_FAILURE[linkFailure] } : { saved: true };
}

/**
 * 채널 저장 — **넣기(upsert) 먼저, 지우기 나중.** 트랜잭션이 없어 중간에 실패할 수 있는데,
 * 이 순서면 남는 것은 *지워야 했던 옛 채널*(보이지만 무해하고 다시 저장하면 사라진다)이다.
 * 반대로 하면 *교회가 저장한 줄 아는 채널이 없는* 상태가 남는다.
 *
 * ⚠️ **`onConflict`를 반드시 준다.** `upsert`는 기본으로 **기본키**(`id`) 충돌을 보는데 우리는
 *    `id`를 보내지 않아 매번 새 삽입이 된다 → 두 번째 저장에서 `UNIQUE(church_id, type)` 위반으로
 *    터진다(첫 저장만 되는 버그).
 *
 * @returns 실패한 단계, 성공하면 `null`
 */
async function saveChannels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  churchId: string,
  draft: ChurchInfoDraft,
): Promise<keyof typeof LINK_FAILURE | null> {
  const rows = toChannelRows(draft, churchId);

  if (rows.length > 0) {
    const up = await supabase.from("church_links").upsert(rows, { onConflict: "church_id,type" });
    if (up.error) {
      console.error("[church-info] 채널 저장 실패", up.error);
      return "save";
    }
  }

  // 남길 것 빼고 전부 지운다 — "비운 것만 지운다"보다 술어가 하나로 끝난다.
  // 값은 `CHURCH_CHANNELS`의 닫힌 대문자 키라 따옴표·주입 걱정이 없다.
  // ⚠️ **남길 것이 없으면 조건을 아예 걸지 않는다** — 빈 목록으로 `not.in.()`을 보내면 PostgREST가
  //    거부하거나(그러면 아무것도 안 지워진다) 전부 일치로 읽는다. 어느 쪽이든 이 분기가 하려는
  //    일(전부 지우기)을 명시로 쓰는 것이 낫다.
  const kept = rows.map((row) => row.type);
  const remove =
    kept.length > 0
      ? supabase
          .from("church_links")
          .delete()
          .eq("church_id", churchId)
          .not("type", "in", `(${kept.join(",")})`)
      : supabase.from("church_links").delete().eq("church_id", churchId);

  const cleared = await remove;
  if (cleared.error) {
    console.error("[church-info] 채널 정리 실패", cleared.error);
    return "cleanup";
  }
  return null;
}
