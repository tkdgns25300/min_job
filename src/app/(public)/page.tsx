import Link from "next/link";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JobCard } from "@/components/job/job-card";
import { getAdJobs, getRecentJobs, getJobStats } from "@/mocks";

export default function HomePage() {
  const adJobs = getAdJobs();
  const recentJobs = getRecentJobs(6);
  const stats = getJobStats();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-8">
      {/* 검색 */}
      <section className="space-y-4 pt-4 sm:pt-8">
        <p className="text-center text-sm text-muted-foreground sm:text-base">
          흩어진 부교역자 청빙 공고를 한곳에서 — 교단·지역·사례비로 검색·비교
        </p>
        <form action="/jobs" className="mx-auto flex max-w-2xl gap-2">
          <Input
            name="q"
            placeholder="교회명 · 지역 · 직분 검색"
            aria-label="공고 검색"
            className="h-11 flex-1"
          />
          <button type="submit" className={cn(buttonVariants({ size: "lg" }))}>
            검색
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          지금 모집 중 <b className="font-semibold text-foreground">{stats.openCount}</b>건 · 이번
          주 새 공고 <b className="font-semibold text-foreground">{stats.newThisWeek}</b>건
        </p>
      </section>

      {/* 추천 청빙 (대표 광고) */}
      {adJobs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">
            추천 청빙{" "}
            <span className="text-sm font-normal text-muted-foreground">AD · 대표 광고</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {adJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {/* 최신 공고 */}
      <section className="space-y-3">
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
