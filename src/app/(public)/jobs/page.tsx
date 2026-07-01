import { Placeholder } from "@/components/layout/placeholder";

export default function JobsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* 타이틀 바 + 검색 + 탭 */}
      <div className="space-y-4 border-b pb-6">
        <div>
          <h1 className="text-xl font-bold">부교역자 청빙</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            공고 목록 · 검색 · 필터 (레이아웃 자리)
          </p>
        </div>
        <Placeholder label="검색 바 영역" className="max-w-xl" />
        <Placeholder label="탭 영역 (전체 · 전임 · 파트 · 마감임박)" />
      </div>

      {/* 필터 사이드바 + 목록 (2단) */}
      <div className="mt-6 grid gap-6 md:grid-cols-[240px_1fr]">
        <aside>
          <Placeholder
            label="상세 필터 (교단 · 직분 · 부서 · 지역 · 사례비)"
            className="min-h-64 md:sticky md:top-16"
          />
        </aside>
        <main className="space-y-3">
          <Placeholder label="목록 헤더 (총 N건 · 정렬: 최신·사례비·마감임박)" />
          <Placeholder
            label="공고 목록 영역 (공고 카드 반복 · 프리미엄/재공고 표시)"
            className="min-h-96"
          />
        </main>
      </div>
    </div>
  );
}
