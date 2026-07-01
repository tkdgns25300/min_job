import Link from "next/link";
import { Placeholder } from "@/components/layout/placeholder";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10">
      {/* 인트로 */}
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">흩어진 부교역자 청빙 공고를 한곳에서</h1>
        <p className="text-muted-foreground">
          교단·지역·사례비·부서로 검색하고 비교하세요. (홈 인트로 자리)
        </p>
      </section>

      {/* 추천 청빙 (대표 광고) */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          추천 청빙{" "}
          <span className="text-sm font-normal text-muted-foreground">AD · 대표 광고</span>
        </h2>
        <Placeholder label="대표 광고 카드 영역 (프리미엄 공고)" className="min-h-32" />
      </section>

      {/* 최신 공고 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">최신 청빙 공고</h2>
          <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">
            전체 공고 보기 →
          </Link>
        </div>
        <Placeholder label="최신 공고 카드 그리드 영역" className="min-h-64" />
      </section>
    </div>
  );
}
