import Link from "next/link";
import { Search } from "lucide-react";
import { facetPathForLabel } from "@/lib/job-facets";

// 홈 우측 사이드바 — 추천 검색어(운영자 큐레이션) + 교회 진입 CTA.
// 추천 검색어는 검색 로그가 없어 손으로 고른 목록. 로그 쌓이면 실제 인기어로 대체.
//
// 랜딩이 있는 말(지역·직분·부서)은 **검색 쿼리가 아니라 랜딩으로 보낸다** — 사용자에겐 더 정확한 화면이고,
// 홈에서 랜딩으로 가는 내부 링크가 공짜로 생긴다(크롤러의 발견 경로). 교단·자유어는 그대로 검색이다.
const RECOMMENDED_SEARCHES = [
  "전도사",
  "부목사",
  "유초등부",
  "청년부",
  "중고등부",
  "서울",
  "경기",
  "예장합동",
] as const;

export function HomeSidebar() {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
          <Search className="size-3.5 text-primary" />
          추천 검색어
        </h3>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDED_SEARCHES.map((term) => (
            <Link
              key={term}
              href={facetPathForLabel(term) ?? `/jobs?q=${encodeURIComponent(term)}`}
              className="rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-[13px] text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
            >
              {term}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-primary p-5 text-primary-foreground">
        <h3 className="text-[15px] font-bold">우리 교회도 청빙 중인가요?</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-primary-foreground/75">
          등록은 무료입니다. 몇 분이면 공고를 올릴 수 있어요.
        </p>
        <Link
          href="/jobs/new"
          className="mt-4 block rounded-lg bg-white px-3 py-2.5 text-center text-sm font-bold text-primary transition-colors hover:bg-white/90"
        >
          교회 공고 등록
        </Link>
      </section>
    </aside>
  );
}
