"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readBookmarks, toggleBookmark } from "@/lib/bookmarks";
import { clearRecentJobs, readRecentJobs, type RecentJob } from "@/lib/recent-jobs";
import { churchLocation, formatPay, jobRoleLine } from "@/lib/format";
import type { JobCard } from "@/types/domain";

// 사역자 view의 "내 활동" — 저장한 공고(북마크) + 최근 본 공고. 둘 다 localStorage 기반(로그인 불필요).
// 저장 ID만 저장되므로, 서버가 넘긴 전체 카드(allCards)에서 매칭해 렌더한다.
// ⚠️ Phase 1: 계정 귀속 북마크(bookmarks 테이블) 서버 조회로 대체 — 이 클라 필터는 mock 과도기.
export function MinisterActivity({ allCards }: { allCards: JobCard[] }) {
  const [hydrated, setHydrated] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentJob[]>([]);

  useEffect(() => {
    // 클라이언트 전용 localStorage 읽기 (SSR엔 없음)
    /* eslint-disable react-hooks/set-state-in-effect */
    setSavedIds(readBookmarks());
    setRecent(readRecentJobs());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const cardById = useMemo(() => new Map(allCards.map((c) => [c.id, c])), [allCards]);
  const saved = savedIds.map((id) => cardById.get(id)).filter((c): c is JobCard => Boolean(c));

  function unsave(id: string) {
    toggleBookmark(id);
    setSavedIds((ids) => ids.filter((x) => x !== id));
  }

  function clearRecent() {
    clearRecentJobs();
    setRecent([]);
  }

  return (
    <>
      {/* 저장한 공고 — 재방문 앵커 */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-bold">저장한 공고</h2>
          {hydrated && saved.length > 0 && (
            <span className="text-sm text-muted-foreground">{saved.length}</span>
          )}
        </div>

        {!hydrated ? (
          <ActivitySkeleton />
        ) : saved.length > 0 ? (
          <>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
              {saved.map((job) => (
                <SavedRow key={job.id} job={job} onUnsave={unsave} />
              ))}
            </div>
            <p className="px-1 text-xs text-muted-foreground">
              지금은 이 브라우저에 저장돼요 — 로그인 계정에 저장(어느 기기서든)은 곧 켜집니다.
            </p>
          </>
        ) : (
          <div className="space-y-3 rounded-2xl border border-dashed p-8 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">
              아직 저장한 공고가 없어요. 마음에 드는 청빙을 저장해두면 여기 모여서 다시 찾기 쉬워요.
            </p>
            <Link href="/jobs" className={cn(buttonVariants({ size: "sm" }))}>
              공고 보러 가기
            </Link>
          </div>
        )}
      </section>

      {/* 최근 본 공고 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">최근 본 공고</h2>
          {hydrated && recent.length > 0 && (
            <button
              type="button"
              onClick={clearRecent}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              모두 지우기
            </button>
          )}
        </div>

        {!hydrated ? (
          <ActivitySkeleton />
        ) : recent.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
            {recent.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/jobs/${it.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
                >
                  <span className="line-clamp-1 text-sm font-medium">{it.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{it.location ?? it.subtitle}</span>
                    {it.pay && <span className="font-bold text-primary">{it.pay}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            최근 본 공고가 여기 표시돼요.
          </p>
        )}
      </section>
    </>
  );
}

function SavedRow({ job, onUnsave }: { job: JobCard; onUnsave: (id: string) => void }) {
  const hasPay = job.payMin !== null || job.payMax !== null;
  return (
    <article className="relative flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5">
      <Link href={`/jobs/${job.id}`} className="absolute inset-0" aria-label={job.title} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold tracking-tight">{job.title}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {churchLocation(job.church)} · {job.church.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{jobRoleLine(job)}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn(hasPay ? "font-bold text-primary" : "text-sm text-muted-foreground")}>
          {formatPay(job.payMin, job.payMax, job.payNote)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onUnsave(job.id)}
        className="relative z-10 shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
      >
        저장 해제
      </button>
    </article>
  );
}

function ActivitySkeleton() {
  return <div className="h-28 animate-pulse rounded-2xl bg-muted" />;
}
