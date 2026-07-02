import Link from "next/link";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JobCard } from "@/components/job/job-card";
import { getAdJobs, getRecentJobs, getJobStats } from "@/lib/queries/jobs";

function Stat({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tabular-nums">
        {value}
        <span className="ml-0.5 text-sm font-semibold text-muted-foreground">{unit}</span>
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default async function HomePage() {
  const adJobs = await getAdJobs();
  const recentJobs = await getRecentJobs(6);
  const stats = await getJobStats();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-14 px-4 py-8">
      {/* 히어로 — 소개 + 검색 + 활성 스탯 (중앙 정렬) */}
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 pt-8 text-center sm:pt-14">
        <div className="space-y-3">
          <h1 className="text-3xl leading-snug font-bold tracking-tight text-balance sm:text-4xl">
            흩어진 사역자 청빙, 한곳에서
          </h1>
          <p className="text-muted-foreground">교단·지역·사례비로 검색하고 한눈에 비교하세요.</p>
        </div>

        <form action="/jobs" className="flex w-full gap-2">
          <Input
            name="q"
            placeholder="교회명 · 지역 · 직분 검색"
            aria-label="공고 검색"
            className="h-12 flex-1"
          />
          <button type="submit" className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}>
            검색
          </button>
        </form>

        <dl className="flex items-center justify-center gap-5 sm:gap-8">
          <Stat value={stats.openCount} unit="건" label="지금 모집 중" />
          <div className="h-8 w-px bg-border" />
          <Stat value={stats.newThisWeek} unit="건" label="이번 주 새 공고" />
          <div className="h-8 w-px bg-border" />
          <Stat value={stats.churchCount} unit="곳" label="청빙 중 교회" />
        </dl>
      </section>

      {/* 추천 청빙 (대표 광고) — 패널로 구획 */}
      {adJobs.length > 0 && (
        <section className="rounded-2xl border bg-muted/40 p-5 sm:p-6">
          <h2 className="text-lg font-bold">
            추천 청빙 <span className="text-sm font-normal text-muted-foreground">AD · 대표 광고</span>
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {adJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {/* 최신 공고 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">최신 청빙 공고</h2>
          <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">
            전체 공고 보기 →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </section>
    </div>
  );
}
