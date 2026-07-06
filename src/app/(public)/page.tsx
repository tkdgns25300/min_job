import Link from "next/link";
import { JobRow } from "@/components/job/job-row";
import { FeaturedJobCard } from "@/components/job/featured-job-card";
import { HomeSidebar } from "@/components/home/home-sidebar";
import { SearchBox } from "@/components/search/search-box";
import { getAdJobs, getListJobs, getJobStats, getSearchSuggestions } from "@/lib/queries/jobs";

function HeroStat({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <div className="text-center">
      <dd className="text-2xl font-bold tabular-nums">
        {value}
        <span className="ml-0.5 text-sm font-semibold text-white/55">{unit}</span>
      </dd>
      <dt className="mt-1.5 text-xs text-white/55">{label}</dt>
    </div>
  );
}

export default async function HomePage() {
  const [adJobs, listJobs, stats, suggestions] = await Promise.all([
    getAdJobs(),
    getListJobs(8),
    getJobStats(),
    getSearchSuggestions(),
  ]);

  return (
    <>
      {/* 히어로 — 풀블리드 딥그린 (헤더와 이어짐), 중앙 정렬 */}
      <section className="bg-hero text-white">
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="mx-auto max-w-2xl py-20 text-center sm:py-24">
            <p className="mb-5 flex items-center justify-center gap-2.5 text-sm font-semibold tracking-wide text-gold">
              <span className="h-px w-5 bg-gold/55" />
              한국교회 사역자 청빙 플랫폼
              <span className="h-px w-5 bg-gold/55" />
            </p>
            <h1 className="text-4xl leading-[1.22] font-extrabold tracking-[-0.03em] break-keep text-balance sm:text-5xl">
              다음 사역지,
              <br className="hidden sm:block" /> 여기서 찾으세요
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-[17px] leading-relaxed break-keep text-white/70">
              여러 신학교·교단 게시판을 돌아다닐 필요 없이, 한 곳에서 검색하고 비교하세요.
            </p>

            <div className="mx-auto mt-8 w-full max-w-xl">
              <SearchBox suggestions={suggestions} />
            </div>

            <dl className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
              <HeroStat value={stats.openCount} unit="건" label="지금 모집 중" />
              <span className="hidden h-8 w-px bg-white/15 sm:block" />
              <HeroStat value={stats.newThisWeek} unit="건" label="이번 주 새 공고" />
              <span className="hidden h-8 w-px bg-white/15 sm:block" />
              <HeroStat value={stats.churchCount} unit="곳" label="함께하는 교회" />
            </dl>
          </div>
        </div>
      </section>

      {/* 노출 등급 분리: 추천 청빙(대표광고 카드) + 청빙 공고(프리미엄+일반 리스트) + 사이드바 */}
      <div className="mx-auto w-full max-w-6xl space-y-12 px-4 pt-12 pb-24">
        {/* ① 추천 청빙 = 대표광고 슬롯 */}
        {adJobs.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-bold">추천 청빙</h2>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                대표광고
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {adJobs.map((job) => (
                <FeaturedJobCard key={job.id} job={job} />
              ))}
            </div>
          </section>
        )}

        {/* ② 청빙 공고(프리미엄 상단+일반) 2단 — 좌 리스트 / 우 사이드바 */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">청빙 공고</h2>
              <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">
                전체 공고 보기 →
              </Link>
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
              {listJobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          </section>

          <HomeSidebar />
        </div>
      </div>
    </>
  );
}
