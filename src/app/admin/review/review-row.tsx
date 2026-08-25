import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { DEPARTMENTS, POSITIONS, REGIONS, type Position } from "@/constants/domain";
import { boardLabel, REJECT_REASONS, REVIEW_STATUSES } from "@/constants/review";
import { enumLabel } from "@/lib/domain-enum";
import { positionLabel } from "@/lib/format";
import type { Attention, AttentionLevel } from "@/lib/review-flags";
import type { QueueNeighbor, ReviewRow } from "@/lib/queries/review";

// 검수 큐 한 줄. **"왜 봐야 하나"가 이 행의 주인공**이다 — `confidence`는 등급만 말하고 이유를
// 말하지 않으므로, 저장된 값에서 계산한 판정이 그 자리를 채운다(lib/review-flags).

/**
 * 확인할 것 — **세 단계로 색이 갈린다**(lib/review-flags의 `AttentionLevel`).
 *
 * 처음엔 색 없는 한 줄 글이었는데, 판정이 여러 개 붙는 행에서 **급한 것과 참고가 같은 회색**이라
 * 구별이 안 됐다(운영자 지적 2026-08-23). 색은 장식이 아니라 **행동이 다르다는 표시**다:
 * 막힘 = 고쳐야 승인된다 · 판단 = 사람이 결론을 내야 한다 · 참고 = 알고만 있으면 된다.
 */
const LEVEL_SKIN: Record<AttentionLevel, string> = {
  blocked: "border-destructive/30 bg-destructive/8 text-destructive font-bold",
  judge: "border-gold/45 bg-gold/12 text-gold-ink font-semibold",
  note: "border-border bg-muted/60 text-muted-foreground",
};

export function AttentionLine({ items }: { items: Attention[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">확인할 것 없음</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((item) => (
        <li
          key={item.kind}
          className={cn(
            "rounded border px-1.5 py-0.5 text-[11px] whitespace-nowrap",
            LEVEL_SKIN[item.level],
          )}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * 자리 표기 — 사역직은 직분, 일반직은 직무명. 혼합 공고는 둘 다 나온다(DATA §3).
 * 직분 라벨 조립은 `positionLabel`(lib/format)이 단일 소스다 — 여기서 다시 만들지 않는다.
 * 빈 값은 `""` — 자리 표시 문구는 화면마다 달라 호출부가 고른다(`positionLabel`과 같은 계약).
 */
export function seatLabel(
  { position, role }: Pick<ReviewRow["row"], "position" | "role">,
  opts: { full?: boolean } = {},
): string {
  // 크롤러 테이블은 enum이 text라 `string[]`으로 온다 — 라벨 맵에 있는 키만 통과시킨다
  const positions = position.filter((p): p is Position => p in POSITIONS);
  return [positionLabel(positions, opts), role].filter(Boolean).join(" · ");
}

/** 지역 표기 — 운영자 화면이라 미상을 **명시**한다(공개 화면은 조각을 생략한다 · SPEC) */
function placeLabel({ region, city }: Pick<ReviewRow["row"], "region" | "city">): string {
  const wide = enumLabel(REGIONS, region) ?? "지역 미상";
  return [wide, city].filter(Boolean).join(" ");
}

/**
 * 이 건을 여는 링크. **dedup UNCERTAIN은 단건이 아니라 묶음 화면으로 간다** — "이 값이 맞나"가
 * 아니라 "이 둘이 같은 자리인가"를 묻는 건이라 한 건씩 보여주면 판단이 안 된다(SPEC).
 * 목록과 단건의 앞뒤 이동이 같은 규칙을 써야 하므로 여기 한 곳에 둔다.
 */
export function reviewHref(row: QueueNeighbor): string {
  return row.dedup_state === "UNCERTAIN" && row.dedup_key !== null
    ? `/admin/review/${row.id}/group`
    : `/admin/review/${row.id}`;
}

export function ReviewRowItem({ item }: { item: ReviewRow }) {
  const { row, source, attention } = item;
  const isGroup = row.dedup_state === "UNCERTAIN" && row.dedup_key !== null;
  const pending = row.review_status === "PENDING";

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-primary">{row.church_name ?? "교회명 없음"}</p>
        <p className="mt-0.5 font-bold tracking-tight break-keep">{row.title ?? "제목 없음"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {[
            placeLabel(row),
            seatLabel(row) || "자리 미상",
            enumLabel(DEPARTMENTS, row.department),
            boardLabel(source.source_key),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="min-w-0 sm:w-64 sm:shrink-0">
        <AttentionLine items={attention} />
      </div>

      {/* 게시판에 올라온 날. `row.posted_at`을 쓰지 않는 이유는 그것이 묶음의 최신 게시일로
          덮이는 파생값이라서다 — 파생 게시일은 단건 화면이 라벨과 함께 보여준다 */}
      <div className="shrink-0 text-xs tabular-nums text-muted-foreground sm:w-20">
        {source.posted_on}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:w-32 sm:justify-end">
        {pending ? (
          <>
            {/* 판정을 되돌린 건 — 되돌리기는 `reviewed_by`를 지우지 않는다(actions.ts) */}
            {row.reviewed_by && (
              <span className="text-[11px] text-muted-foreground">되돌린 건</span>
            )}
            <Link
              href={reviewHref(row)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {isGroup ? "묶음 판정" : "검토"}
            </Link>
          </>
        ) : (
          <>
            <ProcessedState row={row} />
            {/* 처리된 건도 열 수 있어야 한다 — 메모를 다시 읽고 되돌리는 곳이 단건 화면이다 */}
            <Link
              href={reviewHref(row)}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              보기
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

/** 처리된 행 — 왜 그렇게 됐는지와, 사람이 했는지(`reviewed_by`)를 보여준다 */
function ProcessedState({ row }: { row: ReviewRow["row"] }) {
  const approved = row.review_status === "APPROVED";
  return (
    <div className="text-right text-[11px] leading-tight">
      <p className={cn("font-bold", approved ? "text-primary" : "text-muted-foreground")}>
        {enumLabel(REVIEW_STATUSES, row.review_status)}
        {row.reject_reason && ` · ${enumLabel(REJECT_REASONS, row.reject_reason)}`}
      </p>
      <p className="mt-0.5 text-muted-foreground">
        {/* `reviewed_by`가 비어 있으면 크롤러 자동 판정이다 — 크롤러는 이 칸에 값을 쓰지 않는다 */}
        {row.reviewed_by ? "운영자" : "크롤러 자동"}
      </p>
      {approved && (
        <p className="mt-0.5 text-muted-foreground">
          {row.published_job_id ? "공개됨" : "공개 대기"}
        </p>
      )}
    </div>
  );
}
