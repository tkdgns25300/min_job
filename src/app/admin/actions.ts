"use server";

import { updateTag } from "next/cache";
import { requireOperator } from "@/lib/auth-guard";

// 운영자 홈 mutation.
//
// ⚠️ **`updateTag`은 Server Action에서만 부를 수 있다**(Next 문서 명시 — route handler·client에서는
//    던진다). 그래서 크롤러가 우리에게 알려주는 웹훅으로는 이 일을 할 수 없었다: 거기서 쓸 수 있는
//    `revalidateTag`는 stale-while-revalidate라 **다음 방문자가 아직 옛 목록을 본다**. 사람이 누르는
//    버튼이 유일하게 "누른 뒤 바로 새 목록"을 보장하는 경로이고, 그 경로가 마침 Server Action이다.

/**
 * 공개 화면이 읽는 캐시를 지금 비운다 — 크롤러가 `jobs`에 새 공고를 넣은 뒤 쓴다.
 *
 * 공고를 `jobs`에 쓰는 것은 **크롤러(별개 프로세스)**라 우리 캐시를 무효화할 방법이 없다.
 * 그래서 평소에는 `cacheLife("hours")`가 한 시간마다 스스로 갱신하고(바닥선), 즉시 반영이 필요할 때
 * 이 버튼이 그 기다림을 건너뛴다(가속기). 눌러도 `jobs`·`churches`를 **읽지도 쓰지도 않는다** —
 * 다음 요청이 다시 읽게 만들 뿐이다.
 *
 * 태그 둘을 다 비우는 이유: 버튼의 뜻이 "공개 화면이 읽는 것을 다시 읽어라"여야 운영자가 이해할 수
 * 있고, 교회 쪽 조회는 작아서 함께 비우는 비용이 없다.
 *
 * ⚠️ `updateTag`은 즉시 만료다(`revalidateTag`와 달리 stale을 내보내지 않는다) — 누른 뒤 **다음
 *    요청이 새로 계산**하고, 그 요청 하나만 느리다. 클라이언트 라우터 캐시도 함께 비워진다(Next 문서).
 */
export async function refreshPublicCache(): Promise<void> {
  await requireOperator();
  updateTag("jobs");
  updateTag("churches");
}
