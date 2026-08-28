"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readBookmarks, toggleBookmark } from "@/lib/bookmarks";
import { clearRecentJobs, readRecentJobs } from "@/lib/recent-jobs";
import { churchLocation, formatPay, jobRoleLine } from "@/lib/format";
import type { JobCard } from "@/types/domain";

// 사역자 view의 "내 활동" — 저장한 공고(북마크) + 최근 본 공고. 둘 다 localStorage 기반(로그인 불필요).
// 두 목록 모두 **id만 믿고** 서버가 넘긴 전체 카드(allCards)에서 찾아 그린다 — 그래서 행 모양이 같고,
// 지워진 공고는 두 목록에서 함께 사라진다.
// ⚠️ 한때 최근 목록만 localStorage에 캐시한 제목·지역을 그대로 그렸다(2026-08-28 정리). 그래서 지운
//    공고가 **눌러도 없는 페이지**로 남았고, 저장 목록과 행 모양도 달랐다(한 줄 vs 세 줄).
// ⬜ 북마크가 아직 localStorage라 클라이언트가 전체 카드에서 걸러낸다 — 계정 귀속으로 옮기면 사라진다.

/**
 * 최근 본 공고를 화면에 몇 개까지 보이나. 저장 상한(`lib/recent-jobs`의 `MAX`=10)과 **다른 값**이다 —
 * 그 상한은 `/jobs` 우측 레일·검색 오버레이도 함께 읽어서 거기서 줄이면 그쪽이 짧아진다.
 * 이 화면에서 "이미 본 것"은 가장 값어치가 낮은 정보라 절반만 보인다(한때 열 개가 화면의 60%였다).
 */
const RECENT_SHOWN = 5;

export function MinisterActivity({ allCards }: { allCards: JobCard[] }) {
  const [hydrated, setHydrated] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    // 클라이언트 전용 localStorage 읽기 (SSR엔 없음)
    /* eslint-disable react-hooks/set-state-in-effect */
    setSavedIds(readBookmarks());
    setRecentIds(readRecentJobs().map((it) => it.id));
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const cardById = useMemo(() => new Map(allCards.map((c) => [c.id, c])), [allCards]);
  // 카드에 없는 id는 지워진 공고다 — 조용히 뺀다(눌러도 갈 곳이 없다)
  const resolve = (ids: string[]) =>
    ids.map((id) => cardById.get(id)).filter((c): c is JobCard => Boolean(c));

  function unsave(id: string) {
    toggleBookmark(id);
    setSavedIds((ids) => ids.filter((x) => x !== id));
  }

  function clearRecent() {
    clearRecentJobs();
    setRecentIds([]);
  }

  return (
    <>
      <SavedSection hydrated={hydrated} jobs={resolve(savedIds)} onUnsave={unsave} />
      {/* 상한은 **걸러낸 뒤** 건다 — 먼저 자르면 지워진 공고 자리만큼 덜 보인다 */}
      <RecentSection
        hydrated={hydrated}
        jobs={resolve(recentIds).slice(0, RECENT_SHOWN)}
        onClear={clearRecent}
      />
    </>
  );
}

/** 저장한 공고 — 재방문 앵커. 건수를 제목 옆에, 저장 해제를 줄 끝에 */
function SavedSection({
  hydrated,
  jobs,
  onUnsave,
}: {
  hydrated: boolean;
  jobs: JobCard[];
  onUnsave: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-bold">저장한 공고</h2>
        {hydrated && jobs.length > 0 && (
          <span className="text-sm text-muted-foreground">{jobs.length}</span>
        )}
      </div>

      {!hydrated ? (
        <ActivitySkeleton />
      ) : jobs.length > 0 ? (
        <>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                action={
                  <button
                    type="button"
                    onClick={() => onUnsave(job.id)}
                    className="relative z-10 shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                  >
                    저장 해제
                  </button>
                }
              />
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
  );
}

/** 최근 본 공고 — 저장 목록과 같은 행, 버튼 없음. 비었을 때는 저장 쪽보다 낮게(둘이 함께 비면 큰 상자 둘) */
function RecentSection({
  hydrated,
  jobs,
  onClear,
}: {
  hydrated: boolean;
  jobs: JobCard[];
  onClear: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">최근 본 공고</h2>
        {hydrated && jobs.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            모두 지우기
          </button>
        )}
      </div>

      {!hydrated ? (
        <ActivitySkeleton />
      ) : jobs.length > 0 ? (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed px-5 py-4 text-center text-sm text-muted-foreground">
          최근 본 공고가 여기 표시돼요.
        </p>
      )}
    </section>
  );
}

/**
 * 공고 한 줄 — 두 목록이 **같은 모양**을 쓴다(제목·마감 배지 / 지역·교회 / 직분 / 사례비).
 * `action`은 줄 끝의 버튼 자리 — 저장 목록만 "저장 해제"를 붙인다. 행 전체가 링크라 그 버튼은
 * `relative z-10`으로 위에 올라와야 눌린다.
 */
function JobRow({ job, action }: { job: JobCard; action?: ReactNode }) {
  const hasPay = job.payMin !== null || job.payMax !== null;
  return (
    <article className="relative flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5">
      <Link href={`/jobs/${job.id}`} className="absolute inset-0" aria-label={job.title} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold tracking-tight">{job.title}</h3>
          {/* 만료 공고도 보여준다(조용히 사라지면 안 됨) — 대신 모집중이 아님을 표시 */}
          {!job.isPubliclyOpen && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              마감
            </span>
          )}
        </div>
        {/* 지역 미상이면 churchLocation이 ""라 " · 교회명"으로 점이 앞에 매달린다 */}
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {[churchLocation(job.church), job.church.name].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{jobRoleLine(job)}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn(hasPay ? "font-bold text-primary" : "text-sm text-muted-foreground")}>
          {formatPay(job)}
        </div>
      </div>
      {action}
    </article>
  );
}

function ActivitySkeleton() {
  return <div className="h-28 animate-pulse rounded-2xl bg-muted" />;
}
