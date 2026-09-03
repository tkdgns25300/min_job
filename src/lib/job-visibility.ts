import { ALWAYS_OPEN_MAX_DAYS } from "@/constants/domain";
import type { Job } from "@/types/domain";

// 공고가 공개 목록에 뜨는지 판정 — DATA.md §6-1.
// ⛔ **유료 노출 판정은 여기 없다**(2026-09-03) — 노출은 `jobs`의 칸이 아니라 원장에서 나온다(`lib/exposure-order`).
// 공개 목록·교회 화면·운영자 화면이 **같은 술어**를 써야 하므로 데이터 계층이 아니라 여기에 둔다.
// ⚠️ 크롤러(min_job_agent)도 사본을 들고 있다 — 아래 `isPubliclyOpen` 주석의 통보 규칙을 볼 것.

/**
 * 만료 판정 기준일 — **한국 시각(Asia/Seoul) 기준 YYYY-MM-DD**.
 *
 * ⚠️ `new Date().toISOString()`을 쓰지 말 것: 서버 TZ가 UTC(Vercel)라 한국 00:00~09:00 사이엔
 *    **어제 날짜**가 나온다. 100% 한국 서비스라 마감일 하루가 통째로 어긋난다.
 * ⚠️ 호출 위치 주의 — cached scope 안에서 부르면 그 캐시 엔트리가 사는 동안 값이 고정된다
 *    (CLAUDE.md `'use cache'` 제약 #2). 공개 목록은 `cacheLife("hours")`라 **한 시간마다** 갱신되고,
 *    운영자가 `/admin`에서 새로고침을 누르면 그 즉시 다시 계산된다 — 날짜가 굳어 있는 창이 그만큼 짧다.
 */
export function todayInSeoul(): string {
  // en-CA 로케일이 YYYY-MM-DD를 준다 — 수동 조립보다 짧고 자릿수 패딩 실수가 없다.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/**
 * ISO 날짜(YYYY-MM-DD)에 일수를 더한다. 결과도 같은 형식이라 문자열 비교로 대소 판정이 된다.
 * 정오를 기준으로 계산해 로컬 TZ가 무엇이든(음수 오프셋·DST 포함) 날짜가 밀리지 않게 한다.
 */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate; // 잘못된 값은 그대로 — 목록 전체가 죽는 것보다 낫다
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 공개 목록(검색·홈·sitemap·JSON-LD)에 뜨는 공고인가 — DATA.md §6-1.
 *
 * `status`만 믿으면 마감일 지난 공고가 영구히 "모집중"으로 남는다(실측 OPEN 79건 중 55건).
 * 크롤링 공고가 실제로 마감됐는지는 알 수 없으므로 `status`는 `OPEN` 그대로 두고 **여기서만** 가린다.
 * ⚠️ 결과를 모듈 상수로 캐싱하지 말 것 — `today`가 서버 시작 시각에 고정돼 날짜 조건이 죽는다.
 *
 * ⚠️⚠️ **크롤러(min_job_agent)가 이 규칙의 사본을 들고 있다 — 고치면 통보한다.**
 *    크롤러는 중복 판정에서 "이 자리가 이미 공개돼 있나"를 볼 때 같은 식을 직접 계산한다
 *    (뷰로 공유하지 않기로 했다 — 양쪽 다 DB를 저장 전용으로 쓰고 판정 규칙을 DB에 넣지 않는다).
 *    통보 대상 두 가지:
 *      1. `status`에 **"보이는" 값이 추가**될 때 — 크롤러는 `='OPEN'`만 본다.
 *         값이 **줄어드는** 방향은 안전하다(2026-08-21 `PENDING` 제거는 통보만 했다).
 *      2. `ALWAYS_OPEN_MAX_DAYS`(90일)가 바뀔 때 — 상시모집 공고의 노출 기간이다.
 *    어긋나면 증상: 크롤러가 "안 보인다"고 판단 → 그 자리의 재게시를 **새 공고로 공개** →
 *    목록에 같은 자리 2건. 조용히 일어나므로 이 주석이 유일한 방어다.
 */
export function isPubliclyOpen(
  job: Pick<Job, "status" | "deadline" | "postedAt">,
  today: string,
): boolean {
  if (job.status !== "OPEN") return false;
  if (job.deadline) return job.deadline >= today;
  return addDays(job.postedAt, ALWAYS_OPEN_MAX_DAYS) >= today; // 상시모집은 게시 후 N일까지
}

/** 공개 목록에서 내려간 이유. null = 노출 중이거나 교회가 직접 마감한 것 */
export type HiddenReason = "deadline" | "stale" | null;

/**
 * 공개 목록에서 내려간 이유 — 교회 화면에서 "왜 안 보이는지" 설명하는 데 쓴다.
 * `status`가 `OPEN`인데 안 보이는 경우만 의미가 있다(그 외는 배지로 이미 드러난다).
 */
export function hiddenReason(
  job: Pick<Job, "status" | "deadline" | "postedAt">,
  today: string,
): HiddenReason {
  if (job.status !== "OPEN" || isPubliclyOpen(job, today)) return null;
  return job.deadline ? "deadline" : "stale";
}
