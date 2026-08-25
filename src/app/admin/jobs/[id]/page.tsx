import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { REGIONS } from "@/constants/domain";
import { requireOperator } from "@/lib/auth-guard";
import { enumLabel } from "@/lib/domain-enum";
import { todayInSeoul } from "@/lib/job-visibility";
import { getJobForEdit } from "@/lib/queries/jobs";
import { JobEditForm } from "./job-edit-form";

export const metadata: Metadata = { title: "공고 수정 | 민잡 운영자" };

// 공개된 공고 하나를 고치고 내리는 화면. dynamic(운영자 게이트가 쿠키를 읽는다) — 값은 캐시된
// seam(`getJobForEdit`)에서 오고 저장 액션이 `updateTag("jobs")`로 비운다.
//
// 목록에 값을 다 실어 행에서 펼치지 않은 이유: `/admin/jobs`는 공고를 **전건 로딩**한다(상한 없음).
// 242건에 payload 125KB인데 3천 건 × 33칸이면 5MB를 넘고, 목록 뷰가 client라 전부 직렬화된다.
export default function AdminJobEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      {/* `params`도 uncached다 — 페이지 본문에서 await하면 셸까지 프리렌더가 막힌다(cacheComponents) */}
      <Suspense fallback={<EditSkeleton />}>
        <EditContent params={params} />
      </Suspense>
    </div>
  );
}

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 운영자 전용 — proxy가 1차로 막지만 여기서도 다시 확인한다(fail-closed)
  await requireOperator();

  const row = await getJobForEdit(id);
  if (!row) notFound();

  return (
    <>
      <nav className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <Link href="/admin/jobs" className="font-semibold text-primary">
          ← 공고 관리로
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/jobs/${row.id}`}
            target="_blank"
            className="font-semibold text-primary underline underline-offset-2"
          >
            공개 화면 보기 ↗
          </Link>
          {/* 수집 공고는 출처가 있다(CHECK `jobs_collected_needs_source_url`) — 값의 근거를 여기서 본다 */}
          {row.source_url && (
            <a
              href={row.source_url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary underline underline-offset-2"
            >
              게시판 원문 ↗
            </a>
          )}
        </div>
      </nav>

      <header className="mt-4">
        <p className="text-xs font-bold text-primary">{row.church_name}</p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight break-keep">{row.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {/* 게시일과 그 안내는 값 목록의 읽기 전용 줄이 맡는다 — 머리에서 두 번 말하지 않는다 */}
          {[enumLabel(REGIONS, row.region), row.church_id === null && "수집 공고"]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <div className="mt-4">
        <JobEditForm row={row} today={todayInSeoul()} />
      </div>
    </>
  );
}

function EditSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="h-14 w-80 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-96 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
