"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useBookmarks } from "@/components/job/bookmark-provider";
import { cn } from "@/lib/utils";
import { clearRecentJobs, readRecentJobs } from "@/lib/recent-jobs";
import { churchLocation, formatPay, jobRoleLine } from "@/lib/format";
import type { JobCard } from "@/types/domain";
import { getRecentJobCards } from "./actions";

// 사역자 view의 "내 활동" — 저장한 공고 + 최근 본 공고. 두 목록은 같은 행(`JobRow`)을 쓴다.
//
// · **저장한 공고**는 서버가 이 사람 것만 꺼내 준다(`getBookmarkedJobCards` · 2026-08-28 DB 이전).
//   화면에서 "저장 해제"를 누르면 `useBookmarks`의 id 집합이 먼저 바뀌고, 목록은 그 집합으로 걸러져
//   바로 사라진다 — 서버가 준 배열은 그대로고 무엇을 보일지만 컨텍스트가 정한다.
// · **최근 본 공고**는 여전히 localStorage다(계정 데이터가 아니다). id만 저장돼 있어 카드는 서버에
//   물어 온다(`getRecentJobCards`) — 지워진 공고는 그 답에 없으니 자연히 빠진다.
// ⚠️ 한때 두 목록 모두 서버가 **공고 885건 전부**를 내려 보내고 클라이언트가 걸러냈다.

/**
 * 최근 본 공고를 화면에 몇 개까지 보이나. 저장 상한(`RECENT_JOBS_MAX`=10)과 **다른 값**이다 —
 * 그 상한은 `/jobs` 우측 레일·검색 오버레이도 함께 읽어서 거기서 줄이면 그쪽이 짧아진다.
 * 이 화면에서 "이미 본 것"은 가장 값어치가 낮은 정보라 절반만 보인다(한때 열 개가 화면의 60%였다).
 */
const RECENT_SHOWN = 5;

export function MinisterActivity({ saved }: { saved: JobCard[] }) {
  const { ids, toggle } = useBookmarks();
  // seed 전(`null`)에는 서버 목록을 그대로 — 둘은 같은 요청에서 나온 같은 답이다
  const visibleSaved = ids ? saved.filter((job) => ids.has(job.id)) : saved;

  return (
    <>
      <SavedSection jobs={visibleSaved} onUnsave={toggle} />
      <RecentSection />
    </>
  );
}

/** 저장한 공고 — 재방문 앵커. 건수를 제목 옆에, 저장 해제를 줄 끝에 */
function SavedSection({ jobs, onUnsave }: { jobs: JobCard[]; onUnsave: (id: string) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-bold">저장한 공고</h2>
        {jobs.length > 0 && <span className="text-sm text-muted-foreground">{jobs.length}</span>}
      </div>

      {jobs.length > 0 ? (
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

/**
 * 최근 본 공고 카드 — localStorage의 id를 읽어 서버에 물어 온다. 답이 오기 전은 `null`.
 * 순서는 **본 순서**(localStorage 순)로 다시 놓는다 — 서버 답은 순서를 보장하지 않는다.
 */
function useRecentJobCards(): { recent: JobCard[] | null; clear: () => void } {
  const [recent, setRecent] = useState<JobCard[] | null>(null);

  useEffect(() => {
    const ids = readRecentJobs().map((it) => it.id);
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent([]);
      return;
    }
    let cancelled = false;
    getRecentJobCards(ids)
      .then((cards) => {
        if (cancelled) return;
        const byId = new Map(cards.map((c) => [c.id, c]));
        setRecent(
          ids
            .map((id) => byId.get(id))
            .filter((c): c is JobCard => Boolean(c))
            .slice(0, RECENT_SHOWN),
        );
      })
      .catch((thrown: unknown) => {
        // 가장 값어치 낮은 목록이다 — 실패하면 비운 채 두고 로그만 남긴다(화면을 막지 않는다)
        console.error("[mypage] 최근 본 공고 조회 실패", thrown);
        if (!cancelled) setRecent([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clear = () => {
    clearRecentJobs();
    setRecent([]);
  };

  return { recent, clear };
}

/** 최근 본 공고 — 답이 오기 전은 스켈레톤. 비었을 때는 저장 쪽보다 낮게(둘이 함께 비면 큰 상자 둘) */
function RecentSection() {
  const { recent, clear } = useRecentJobCards();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">최근 본 공고</h2>
        {recent && recent.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            모두 지우기
          </button>
        )}
      </div>

      {recent === null ? (
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      ) : recent.length > 0 ? (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
          {recent.map((job) => (
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
