import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PATHNAME_HEADER, loginPathWithNext, safeInternalPath } from "@/lib/auth";
import { isOperatorEmail } from "@/lib/operator";
import { getCurrentUser } from "@/lib/queries/users";
import type { CurrentUser } from "@/types/domain";

/**
 * 인증 게이트(최종 방어선) — 로그인 안 했으면 로그인 페이지로 보낸다(?next=로 복귀 경로 유지).
 *
 * 2단 방어 구조인 이유:
 *  - cacheComponents가 켜져 있어 uncached read(쿠키)는 `<Suspense>` 안에서만 허용된다
 *    → 이 함수는 Suspense 안의 async 컴포넌트에서 부르게 되고, 그 리다이렉트는 HTTP 307이 아니라
 *      스트림 데이터로 전달된다(응답 자체는 200 + 스켈레톤).
 *  - 그래서 비로그인 차단의 **1차 방어선은 proxy.ts**가 맡는다(진짜 307).
 *  - 여기는 **최종 방어선** — proxy 경로 목록에서 빠진 페이지가 생겨도 데이터가 새지 않게 한다.
 *
 * 복귀 경로는 proxy가 넘긴 헤더에서 읽는다 — 페이지마다 자기 경로를 적지 않아도 되고
 * (경로 지식은 proxy.ts 한 곳), 쿼리스트링까지 그대로 보존된다.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPathWithNext(await currentPath()));
  return user;
}

/**
 * 운영자 게이트 — 로그인 + `.env` `ADMIN_EMAILS` 일치까지 확인한다.
 * 운영자가 아니면 `notFound()`.
 * ⚠️ PPR에선 셸(제목·사이드바)이 이미 나간 뒤라 "존재 은닉"은 **proxy의 리다이렉트**가 담당하고,
 *    여기 역할은 **PII 차단**이다 — 데이터 조회를 이 함수 뒤에 두어야 의미가 있다.
 */
export async function requireOperator(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isOperatorEmail(user.email)) notFound();
  return user;
}

// proxy가 넣어준 현재 경로. proxy는 매 요청 헤더를 덮어쓰므로 클라이언트 위조값은 남지 않지만,
// 매처에서 빠진 경로(헤더 없음)나 만약의 위조에 대비해 항상 safeInternalPath로 통과시킨다.
async function currentPath(): Promise<string> {
  return safeInternalPath((await headers()).get(PATHNAME_HEADER));
}
