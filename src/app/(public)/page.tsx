import type { Metadata } from "next";
import Link from "next/link";
import { JobRow } from "@/components/job/job-row";
import { JobCard } from "@/components/job/job-card";
import { HomeSidebar } from "@/components/home/home-sidebar";
import { SearchBox } from "@/components/search/search-box";
import { getHomeFeed, getJobStats, getSearchSuggestions } from "@/lib/queries/jobs";

// title·description은 root layout 값을 그대로 쓴다(홈 = 사이트 대표 페이지).
// canonical만 지정 — 공유 링크에 붙는 추적 쿼리(?utm_*)가 별도 페이지로 색인되지 않게.
export const metadata: Metadata = { alternates: { canonical: "/" } };

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
  const [feed, stats, suggestions] = await Promise.all([
    getHomeFeed(),
    getJobStats(),
    getSearchSuggestions(),
  ]);

  return (
    <>
      {/* 히어로 — 풀블리드 딥그린 (헤더와 이어짐), 중앙 정렬 */}
      <section className="bg-hero text-white">
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="group/hero mx-auto max-w-2xl py-20 text-center sm:py-24">
            <p className="mb-5 flex items-center justify-center gap-2.5 text-sm font-semibold tracking-wide text-gold">
              <span className="h-px w-5 bg-gold/55" />
              한국교회 사역자 청빙 플랫폼
              <span className="h-px w-5 bg-gold/55" />
            </p>
            <h1 className="text-4xl leading-[1.22] font-extrabold tracking-[-0.03em] break-keep text-balance sm:text-5xl">
              다음 사역지,
              <br className="hidden sm:block" /> 여기에서 찾으세요
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-[17px] leading-relaxed break-keep text-white/70">
              여러 신학교·교단 게시판을 돌아다닐 필요 없이,
              <br className="hidden sm:block" /> 지역·부서·사례비까지 한눈에 확인하세요.
            </p>

            <div className="mx-auto mt-8 w-full max-w-xl">
              <SearchBox suggestions={suggestions} />
            </div>

            {/* 검색 오버레이가 열리면 감춘다 — 안 그러면 드롭다운이 숫자를 반만 덮는다 */}
            <dl className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4 transition-opacity group-has-[[data-search-open]]/hero:opacity-0">
              <HeroStat value={stats.openCount} unit="건" label="지금 모집 중" />
              <span className="hidden h-8 w-px bg-white/15 sm:block" />
              <HeroStat value={stats.newThisWeek} unit="건" label="이번 주 새 공고" />
              <span className="hidden h-8 w-px bg-white/15 sm:block" />
              {/* "함께하는"으로 되돌리지 말 것 — 수집 교회는 우리와 함께하기로 한 적이 없다(SPEC 히어로) */}
              <HeroStat value={stats.churchCount} unit="곳" label="청빙 중인 교회" />
            </dl>
          </div>
        </div>
      </section>

      {/* 추천 청빙(스페셜 3칸) + 청빙 공고(순수 최신순) + 사이드바 — 자리 규칙은 SPEC 수익화 절 */}
      <div className="mx-auto w-full max-w-6xl space-y-12 px-4 pt-12 pb-24">
        {/* ① 추천 청빙 — 스페셜 자리 3칸. **항상** 그린다: 안 팔린 칸은 최신 공고가 서고 "광고" 라벨만 없다.
            라벨은 카드 안에 있어 섹션 제목엔 붙이지 않는다(칸이 섞일 때 제목 라벨은 거짓이 된다) */}
        <section>
          <h2 className="mb-4 text-lg font-bold">추천 청빙</h2>
          {/* 3열은 md부터 — 640px에서 3열이면 카드 한 장이 200px라 제목이 세 줄로 접힌다 */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {feed.slots.map(({ job, ad }) => (
              <JobCard key={job.id} job={job} ad={ad} />
            ))}
          </div>
        </section>

        {/* ② 청빙 공고(최신순 · 추천 칸에 선 공고 제외) 2단 — 좌 리스트 / 우 사이드바 */}
        {/* ⚠️ `grid-cols-1`을 빼면 lg 아래에서 열이 암묵 `auto`가 되어 내용의 최소 폭만큼 늘어난다 —
            390px에서 목록 카드·사이드바가 오른쪽으로 넘쳐 잘렸다(2026-08-30 전수 점검). `minmax(0,1fr)`을
            lg에만 쓰고 기본을 비워 둔 탓이다 */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">청빙 공고</h2>
              <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">
                전체 공고 보기 →
              </Link>
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
              {feed.latest.map((job) => (
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
