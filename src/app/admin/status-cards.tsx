import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EXPOSURE_PRODUCTS, type ExposureProduct } from "@/constants/domain";
import { boardLabel, boardUrl, CRAWL_OVERDUE_HOURS } from "@/constants/review";
import { promotionPeriod, soldInWeek, type PromotionSpan } from "@/lib/exposure-order";
import { formatKstDayTime } from "@/lib/format";
import type { CrawlRun, FailedSource } from "@/lib/queries/crawl";
import type { AdminOverview, QueueSummary } from "@/types/domain";

// 운영자 홈의 카드 셋 — **순수 프레젠테이션**. 값을 받아 그리기만 하고 **조회를 하지 않는다**(그래야
// 상태들을 DB 없이 값만 바꿔 렌더해 볼 수 있다). "0보다 큰가"·"한 주기를 넘겼나" 같은 **표시 규칙은
// 여기서** 정한다 — 무엇을 진하게·무슨 색으로 그릴지는 그리는 쪽의 일이다. 도메인 판정은 하지 않는다.
//
// 카드마다 주제가 하나다: **들어오는 것**(수집) · **내가 손댈 것**(처리할 일) · **나가는 것**(공개).
// 새로고침 버튼이 화면 바닥이 아니라 공개 카드 안에 있는 이유 — 그 버튼이 다시 세게 만드는 것이
// 바로 그 카드의 수치다.

/**
 * 구획 이름 — **스켈레톤과 본문이 같은 상수를 쓴다.** 제목은 셸에서 바로 그려지고 카드만 흘러들어오므로,
 * 여기서 갈리면 값이 도착할 때 화면이 제목 높이만큼 밀린다.
 */
export const STATUS_SECTIONS = {
  tasks: "처리할 일",
  crawl: "수집",
  publish: "공개",
  exposure: "노출",
} as const;

/** 구획 하나 — 간격은 부모의 `space-y`가 준다(줄에 마진을 붙이면 스켈레톤과 값이 다른 간격을 갖는다) */
export function StatusSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[11px] font-extrabold tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * 색은 **행동이 다르다는 표시**다(검수 큐의 판정 색과 같은 규칙).
 * `quiet` 넘어가도 된다 · `active` 내가 처리할 것이 있다 · `watch` 봐야 할 것이 있다.
 *
 * ⛔ `watch`는 **경보가 아니다.** "마지막 수집이 한 주기를 넘겼다"는 표시 규칙일 뿐이고, 수집이
 *    죽었나(3시간)·게시판이 망가졌나(연속 2회)는 크롤러 `alerts_for`가 정본이다(queries/crawl).
 *    지금 `watch`를 쓰는 곳은 수집 카드 하나다 — 공개 대기의 금색은 카드가 아니라 그 칸이 든다.
 *
 * 수집의 `watch`는 **`CRAWL_OVERDUE_HOURS`를 넘겼나**로 가른다. 처음엔 달력 날짜로 갈랐는데
 * (`오늘 돌렸나`) 수집이 저녁에 도는 동안 **하루 18~20시간이 금색**이었다 — 색이 상시로 켜져 있으면
 * 처리할 일의 초록까지 같이 안 보이게 된다(운영자 지적 2026-08-25). 그 값이 크롤 주기 한 번이고
 * 여유를 두지 않은 이유는 그 상수 주석에 있다.
 */
type Tone = "quiet" | "active" | "watch";

/** 크롤러의 상태·경보 화면 — 판정의 정본이라 우리 화면은 여기로 넘긴다(queries/crawl 머리말) */
const CRAWL_STATUS_COMMAND = "minjob-ingest status";

const MS_PER_HOUR = 3_600_000;

/** 실패한 게시판 이름 — 셋부터는 접는다(한 줄 안에 들어가야 읽힌다) */
const FAILED_NAMES_SHOWN = 2;

const TONE_SKIN: Record<Tone, string> = {
  quiet: "",
  active: "border-primary/25 bg-linear-to-r from-primary/5 to-transparent",
  watch: "border-gold/40 bg-linear-to-r from-gold/10 to-transparent",
};

const TONE_BAR: Record<Tone, string> = {
  quiet: "",
  active: "bg-primary",
  watch: "bg-gold",
};

function StatusCard({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-card", TONE_SKIN[tone])}>
      {tone !== "quiet" && (
        <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", TONE_BAR[tone])} />
      )}
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-bold tracking-wide text-muted-foreground">{children}</div>
  );
}

/**
 * 처리할 큐 하나 — 수집 검수·교회 인증이 같은 컴포넌트를 쓴다.
 * 0은 **"없음"**으로 쓴다: 숫자 0은 "세어 보니 0"인지 "아직 안 세었다"인지 읽는 사람이 모른다.
 */
export function TaskCard({
  label,
  href,
  summary,
  todayKst,
  oldestLabel,
  emptyHint,
}: {
  label: string;
  href: string;
  summary: QueueSummary;
  todayKst: string;
  oldestLabel: string;
  emptyHint: string;
}) {
  const waiting = summary.count > 0;
  return (
    <StatusCard tone={waiting ? "active" : "quiet"}>
      <Link href={href} className="group block px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-[13px] font-extrabold", !waiting && "text-muted-foreground")}>
            {label}
          </span>
          <span aria-hidden className="text-[13px] text-muted-foreground group-hover:text-primary">
            →
          </span>
        </div>
        <p className="mt-1.5 flex items-baseline gap-1.5">
          {waiting ? (
            <>
              <span className="text-[26px] leading-tight font-extrabold tabular-nums text-primary">
                {summary.count}
              </span>
              <span className="text-[13px] font-bold text-muted-foreground">건 대기</span>
            </>
          ) : (
            <span className="text-[19px] font-extrabold text-muted-foreground">없음</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {waiting && summary.oldestAt
            ? `${oldestLabel} ${formatKstDayTime(summary.oldestAt, todayKst)}`
            : emptyHint}
        </p>
      </Link>
    </StatusCard>
  );
}

/**
 * 마지막 수집 — **저장된 사실만** 그린다. "크롤러가 죽었습니다"라고 쓰지 않는 이유는 queries/crawl 머리말에.
 * 실행 결과 한 줄은 `RunResult`가 맡는다(무엇을 쓰고 무엇을 안 쓰는지는 그쪽 머리말에).
 */
export function CrawlCard({
  run,
  todayKst,
  nowMs,
}: {
  run: CrawlRun | null;
  todayKst: string;
  nowMs: number;
}) {
  // 기록이 아예 없는 것도 "한 주기를 넘겼다"와 같은 뜻이다 — 들어오는 것이 없다
  const overdue =
    run === null || nowMs - Date.parse(run.started_at) > CRAWL_OVERDUE_HOURS * MS_PER_HOUR;
  return (
    <StatusCard tone={overdue ? "watch" : "quiet"}>
      <div className="px-4 py-3.5">
        <CardLabel>마지막 수집</CardLabel>
        <p
          className={cn(
            "mt-1 leading-tight font-extrabold",
            run === null ? "text-[19px]" : "text-[22px]",
            overdue && "text-gold-ink",
          )}
        >
          {run === null ? "아직 없음" : formatKstDayTime(run.started_at, todayKst)}
        </p>
        {run !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            <RunResult run={run} />
          </p>
        )}
        <p className="mt-2.5 border-t pt-2.5 text-xs text-muted-foreground">
          게시판별 상태·경보는{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">{CRAWL_STATUS_COMMAND}</code>
        </p>
      </div>
    </StatusCard>
  );
}

/**
 * 실패한 게시판 이름 — **게시판 목록으로 가는 링크**다(운영자가 바로 열어 무슨 일인지 본다). 크롤러가
 * 남긴 에러 문구는 `title`로만 붙인다 — 길고 기술적이라 본문에 그리면 이 카드가 감당하지 못한다.
 * 주소를 모르는 키(새 게시판)는 링크 없이 이름만.
 */
function FailedBoards({ sources }: { sources: FailedSource[] }) {
  const shown = sources.slice(0, FAILED_NAMES_SHOWN);
  const rest = sources.length - FAILED_NAMES_SHOWN;
  return (
    <>
      {shown.map(({ key, error }, i) => {
        const url = boardUrl(key);
        return (
          <span key={key}>
            {i > 0 && " · "}
            {url ? (
              // 외부 주소는 `<a>` — `Link`는 내부 라우트에만(source-pane·poster-view와 같은 관용구)
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={error}
                className="font-semibold text-foreground underline underline-offset-2"
              >
                {boardLabel(key)}
              </a>
            ) : (
              <span title={error}>{boardLabel(key)}</span>
            )}
          </span>
        );
      })}
      {rest > 0 && ` 외 ${rest}`}
    </>
  );
}

/**
 * 실행 결과 한 줄 — 끝난 실행만 수치를 말한다. **말을 크롤러와 맞춘다**(`cli.py`의 실행 요약과 같은 단어).
 *
 * ⚠️ **"정상"이 아니라 "성공"이다.** `sources_ok`는 *예외를 던지지 않은* 게시판 수일 뿐이고,
 *    목록을 0행 받은 게시판도 여기 포함된다 — 그건 크롤러가 `EMPTY`로 기록해 두 번 연속이면
 *    `LISTING_EMPTY` 경보를 내는 상태다(셀렉터 깨짐·로그인벽). "모두 정상"이라고 쓰면
 *    `minjob-ingest status`가 경보를 띄우는 바로 그 순간에 이 화면이 반대말을 하게 된다.
 * **실패한 게시판 이름은 사실이므로 보여준다** — 경보(연속 2회)는 크롤러 판정이지만, "이번 실행에서
 *    이 게시판이 실패했다"는 저장된 값이다(`error_detail`의 키). 개수까지만 말하면 어디가 깨졌는지
 *    알려고 터미널을 여는 수밖에 없어 이 줄이 있으나 없으나 같아진다.
 * ⚠️ **"새 공고"가 아니라 "새로 수집"이다.** `new_count`는 새로 저장된 **원문(`source_data`) 행 수**로,
 *    AI 구조화·검수·공개 이전의 숫자다(그중 17%는 검수 큐에 남고 2%는 자동 거절된다).
 *    같은 카드에 "공개 대기"가 있어서 "공고 N건이 올라갔다"로 읽히면 안 된다.
 * ⚠️ `finished_at`이 비면 **"끝나지 않음"이 아니라 "종료 기록 없음"**이다: 지금 돌고 있는 중일 수도
 *    있고, 그 둘을 가르는 판정은 크롤러 것이다. 그때는 게시판 수치도 쓰지 않는다 — 집계가 끝나지
 *    않아 0/0으로 남아서, 그리면 없는 사실을 말하게 된다(실측 08-24 17:01).
 * ⚠️ **끊긴 실행도 게시판 수치를 쓰지 않는다.** 크롤러는 예외를 잡고 실행을 닫으므로 `finished_at`이
 *    채워지고, `sources_ok`는 손대지 않은 게시판까지 센다 — 3번째에서 죽은 실행이 "전부 성공"으로
 *    나가게 된다. 대신 그 사실("실행이 중단됨")만 말한다.
 */
function RunResult({ run }: { run: CrawlRun }) {
  if (run.finished_at === null) return <>종료 기록 없음</>;
  const boardCount = run.sources_ok + run.sources_failed;
  return (
    <>
      새로 수집 <b className="font-bold text-foreground">{run.new_count}건</b>
      {run.aborted ? (
        <>
          {" · "}
          <b className="font-bold text-foreground">실행이 중단됨</b>
        </>
      ) : (
        boardCount > 0 &&
        (run.sources_failed === 0 ? (
          <>
            {" · "}게시판 <b className="font-bold text-foreground">{boardCount}곳</b> 성공
          </>
        ) : (
          <>
            {" · "}게시판 {boardCount}곳 중{" "}
            <b className="font-bold text-foreground">{run.sources_failed}곳 실패</b>
            {/* 개수와 이름은 크롤러가 같은 dict에서 같이 쓰므로 어긋날 수 없다 — 방어로만 둔다 */}
            {run.failed_sources.length > 0 && (
              <>
                {" — "}
                <FailedBoards sources={run.failed_sources} />
              </>
            )}
          </>
        ))
      )}
    </>
  );
}

function Cell({
  label,
  value,
  href,
  gold,
}: {
  label: string;
  value: number;
  href?: string;
  gold?: boolean;
}) {
  const body = (
    <>
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-[21px] leading-tight font-extrabold tabular-nums",
          gold && "text-gold-ink",
        )}
      >
        {value}
      </div>
    </>
  );
  const shell = "block border-r px-4 py-3 last:border-r-0";
  return href ? (
    <Link href={href} className={cn(shell, "hover:bg-primary/5")}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/**
 * 공개 — 지금 방문자에게 보이는 것과, 보여야 하는데 안 보이는 것.
 *
 * **공개 대기는 링크하지 않는다**: "승인됐지만 아직 안 올라간 건"만 걸러 보는 화면이 없어서,
 * 필터 없는 목록으로 보내는 링크는 없는 것만 못하다. 숫자와 색까지가 이 자리의 몫이다.
 * 그 색도 **그 칸에만** 준다 — 카드째 물들이면 옆의 공개 중·내려감까지 봐야 할 것처럼 보인다.
 */
export function PublicCard({
  overview,
  publishBacklog,
  action,
}: {
  overview: AdminOverview;
  publishBacklog: number;
  action: ReactNode;
}) {
  return (
    <StatusCard tone="quiet">
      {/* 좁은 화면에서도 3열을 유지한다 — 2열로 접으면 오른쪽 칸의 세로선이 카드 가장자리에 남는다 */}
      <div className="grid grid-cols-3">
        <Cell label="공개 중" value={overview.visibleCount} href="/admin/jobs?tab=OPEN" />
        <Cell label="내려감" value={overview.hiddenCount} href="/admin/jobs?tab=HIDDEN" />
        <Cell label="공개 대기" value={publishBacklog} gold={publishBacklog > 0} />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3">
        {action}
        <p className="min-w-52 flex-1 text-[11px] leading-relaxed text-muted-foreground">
          공개 목록은 한 시간마다 스스로 갱신됩니다. 지금 바로 반영하려면 누르세요.
        </p>
      </div>
    </StatusCard>
  );
}

/** "2026-09-07" → "9/7" — 카드 안 주 표기 */
const monthDay = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/**
 * 노출 — 이번 주·다음 주에 등급별로 몇 자리가 팔렸나. **판정은 `lib/exposure-order`**(결제 화면·액션과 같은 함수)라
 * 여기 숫자와 교회가 보는 "남은 자리"가 갈릴 수 없다. 정원 없는 등급(기본)은 팔린 건수만 쓴다.
 * 색은 쓰지 않는다 — 매진은 좋은 일이지 손댈 일이 아니다. 원장 전체는 `/admin/promotions`.
 */
export function ExposureCard({
  weeks,
  paid,
}: {
  /** 이번 주·다음 주 월요일 */
  weeks: [string, string];
  paid: PromotionSpan[];
}) {
  const tiers = Object.keys(EXPOSURE_PRODUCTS) as ExposureProduct[];
  return (
    <StatusCard tone="quiet">
      <div className="grid grid-cols-2">
        {weeks.map((monday, i) => (
          <div key={monday} className="border-r px-4 py-3 last:border-r-0">
            <div className="text-[11px] font-semibold text-muted-foreground">
              {i === 0 ? "이번 주" : "다음 주"} · {monthDay(monday)}~
              {monthDay(promotionPeriod(monday, 1).endsAt)}
            </div>
            <dl className="mt-1.5 space-y-0.5 text-sm">
              {tiers.map((tier) => {
                const { label, weeklyCapacity } = EXPOSURE_PRODUCTS[tier];
                const sold = soldInWeek(tier, monday, paid);
                return (
                  <div key={tier} className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-bold tabular-nums">
                      {weeklyCapacity === null ? `${sold}건` : `${sold}/${weeklyCapacity}`}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
      <div className="border-t px-4 py-2.5 text-[11px] text-muted-foreground">
        <Link href="/admin/promotions" className="font-semibold text-foreground hover:underline">
          노출 원장 →
        </Link>{" "}
        결제·취소 이력 전부
      </div>
    </StatusCard>
  );
}
