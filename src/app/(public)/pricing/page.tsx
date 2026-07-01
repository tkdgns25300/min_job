import { Placeholder } from "@/components/layout/placeholder";

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-12">
      {/* 안내 헤더 */}
      <section className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">광고 · 노출 안내</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          공고 등록은 무료, 더 많이 보이게 하는 건 선택입니다
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          기본 등록은 언제나 무료. 노출 등급을 올려 상단·추천 슬롯에서 더 크게 보이게 할 수 있어요.
          (안내 자리)
        </p>
      </section>

      {/* 노출 등급 3단 */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Placeholder label="일반 (무료)" className="min-h-48" />
        <Placeholder label="프리미엄 (5만원 / 2주 · 인기)" className="min-h-48" />
        <Placeholder label="대표 광고 (15만원 / 2주)" className="min-h-48" />
      </section>
    </div>
  );
}
