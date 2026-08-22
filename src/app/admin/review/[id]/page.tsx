import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOperator } from "@/lib/auth-guard";
import { todayInSeoul } from "@/lib/job-visibility";
import { getQueueNavigation, getReviewDetail, type QueueNeighbor } from "@/lib/queries/review";
import { FlagBadge, reviewHref } from "@/components/admin/review-row";
import { CONFIDENCE_LEVELS } from "@/constants/review";
import { enumLabel } from "@/lib/domain-enum";
import { PassthroughValues } from "./passthrough-values";
import { ReviewForm } from "./review-form";
import { SourcePane } from "./source-pane";

export const metadata: Metadata = { title: "공고 검수 | 민잡 운영자" };

// 단건 검수 — 원문과 구조화된 값을 나란히 놓고 판정한다. dynamic(운영자 전용 · 미검수 데이터 ·
// 포스터 signed URL 만료). 셸에 정적으로 그릴 것이 없어 전체를 <Suspense>로 감싼다.
export default function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      {/* `params`도 uncached다 — 페이지 본문에서 await하면 셸까지 프리렌더가 막힌다(cacheComponents) */}
      <Suspense fallback={<DetailSkeleton />}>
        <DetailContent params={params} />
      </Suspense>
    </div>
  );
}

async function DetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 운영자 전용 · 미검수 데이터 — proxy가 1차로 막지만 여기서도 다시 확인한다(fail-closed).
  await requireOperator();

  const [detail, nav] = await Promise.all([getReviewDetail(id), getQueueNavigation(id)]);
  if (!detail) notFound();

  const { row, flags } = detail;

  return (
    <>
      <nav className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <Link href="/admin/review" className="font-semibold text-primary">
          ← 큐로
        </Link>
        <div className="flex items-center gap-3">
          {/* 처리된 건을 직접 열면 큐에 없다 — 그때 위치를 말하면 거짓말이 된다 */}
          <span className="tabular-nums text-muted-foreground">
            {nav.position > 0 ? `${nav.position} / ${nav.total}` : "큐에 없는 건"}
          </span>
          <NeighborLink neighbor={nav.prev} label="← 이전" />
          <NeighborLink neighbor={nav.next} label="다음 →" />
        </div>
      </nav>

      <header className="mt-4">
        <p className="text-xs font-bold text-primary">{row.church_name ?? "교회명 없음"}</p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight break-keep">
          {row.title ?? "제목 없음"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {flags.map((flag) => (
            <FlagBadge key={flag.key} flag={flag} />
          ))}
          {/* 등급은 이유를 말하지 않으므로 배지 뒤에 보조로만 둔다(constants/review) */}
          <span className="text-[11px] text-muted-foreground">
            크롤러 판단: {enumLabel(CONFIDENCE_LEVELS, row.confidence)}
          </span>
        </div>
      </header>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <SourcePane detail={detail} />
        <ReviewForm detail={detail} today={todayInSeoul()} />
      </div>

      <div className="mt-4">
        <PassthroughValues row={row} />
      </div>
    </>
  );
}

/** 앞뒤 건 — 없으면 자리만 비운다(사라지면 버튼 위치가 흔들려 잘못 누른다) */
function NeighborLink({ neighbor, label }: { neighbor: QueueNeighbor | null; label: string }) {
  if (!neighbor) return <span className="text-muted-foreground/40">{label}</span>;
  return (
    <Link href={reviewHref(neighbor)} className="font-semibold text-primary">
      {label}
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="h-14 w-80 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
