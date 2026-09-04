import Link from "next/link";
import { Search } from "lucide-react";
import { DENOMINATIONS, DEPARTMENTS, POSITIONS, REGIONS } from "@/constants/domain";
import { facetJobsHref } from "@/lib/job-facets";

// 홈 우측 사이드바 — 추천 검색어(운영자 큐레이션) + 교회 진입 CTA.
// 추천 검색어는 검색 로그가 없어 손으로 고른 목록. 로그 쌓이면 실제 인기어로 대체.
//
// 칩은 **`/jobs`에 그 필터가 걸린 상태**로 보낸다(2026-09-05 운영자 결정). 한때 랜딩(`/jobs/region/…`)으로
// 보냈는데, 사이트 안에서 검색어를 누른 사람은 "이 조건의 전체 목록"을 기대하고 랜딩은 사역직만·20건·분포
// 블록이 붙은 검색엔진용 입구라 기대와 어긋났다. 랜딩의 발견 경로는 공고 상세·`/jobs` 허브·sitemap이 맡는다.
// 라벨은 도메인 라벨 맵에서 가져온다 — 칩 글자와 도착한 화면의 필터 칩 글자가 같아야 한다.
const RECOMMENDED_SEARCHES = [
  { label: POSITIONS.EVANGELIST, href: facetJobsHref("position", "EVANGELIST") },
  { label: POSITIONS.ASSOCIATE_PASTOR, href: facetJobsHref("position", "ASSOCIATE_PASTOR") },
  { label: DEPARTMENTS.CHILDREN, href: facetJobsHref("department", "CHILDREN") },
  { label: DEPARTMENTS.YOUNG_ADULT, href: facetJobsHref("department", "YOUNG_ADULT") },
  { label: DEPARTMENTS.YOUTH, href: facetJobsHref("department", "YOUTH") },
  { label: REGIONS.SEOUL, href: facetJobsHref("region", "SEOUL") },
  { label: REGIONS.GYEONGGI, href: facetJobsHref("region", "GYEONGGI") },
  { label: DENOMINATIONS.HAPDONG, href: facetJobsHref("denomination", "HAPDONG") },
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
          {RECOMMENDED_SEARCHES.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-[13px] text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
            >
              {label}
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
