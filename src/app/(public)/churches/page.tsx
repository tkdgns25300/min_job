import { Placeholder } from "@/components/layout/placeholder";

export default function ChurchesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold">교회</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          교단·지역으로 교회를 찾아보세요 (레이아웃 자리)
        </p>
      </div>
      <Placeholder label="교회 검색·필터 영역" className="max-w-xl" />
      <Placeholder label="교회 목록 영역 (교회 카드 · 공고 수)" className="min-h-96" />
    </div>
  );
}
