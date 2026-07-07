import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "공고 노출 안내 | 민잡",
  description:
    "청빙 공고를 더 많은 교역자에게. 공고 등록은 무료, 노출 상품(프리미엄·대표광고)으로 더 눈에 띄게 보여주세요.",
};

// 노출 상품 2종 — 가격·상세는 Phase 2 확정, 지금은 "문의"
const PRODUCTS = [
  {
    name: "프리미엄",
    tagline: "공고를 목록 상단에 고정하고 강조 배지로 눈에 띄게.",
    where: "공고 목록 상단 고정",
  },
  {
    name: "대표광고",
    tagline: "홈·목록 최상단 추천 슬롯에 더 크게. 주목도가 가장 높아요.",
    where: "홈·공고 목록 상단 추천(AD)",
  },
] as const;

const STEPS = [
  { title: "공고 등록 (무료)", desc: "교회로 가입하고 청빙 공고를 등록하세요." },
  { title: "노출 상품 선택", desc: "프리미엄·대표광고 중 원하는 노출을 고르세요." },
  { title: "문의로 진행", desc: "노출 기간·결제는 문의로 진행돼요. (자동 결제는 준비 중)" },
] as const;

const FAQS = [
  {
    q: "공고 등록도 돈을 내야 하나요?",
    a: "아니요. 공고 등록은 언제나 무료입니다. 노출 상품을 선택할 때만 비용이 발생해요.",
  },
  {
    q: "노출은 언제부터 되나요?",
    a: "신청·확인 후 노출됩니다. 노출 기간은 상품별로 안내해 드려요.",
  },
  {
    q: "지금 바로 결제할 수 있나요?",
    a: "현재는 문의로 진행됩니다. 자동 결제는 준비 중이에요.",
  },
  {
    q: "세금계산서 발행이 되나요?",
    a: "문의 주시면 발행 절차를 안내해 드립니다.",
  },
] as const;

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-12 px-4 py-10">
      {/* 헤더 — 가치 제안 + 등록 무료 */}
      <header className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">공고 노출 안내</p>
        <h1 className="text-2xl leading-snug font-bold tracking-tight text-balance sm:text-3xl">
          청빙 공고를 더 많은 교역자에게
        </h1>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          공고 등록은 <b className="font-semibold text-foreground">언제나 무료</b>입니다. 노출
          상품은 공고를 더 눈에 띄는 위치에 보여주고 싶을 때만 선택하세요.
        </p>
      </header>

      {/* 노출 상품 2종 */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">노출 상품</h2>
        {/* 상품은 2종 — 2열이 빈 칸 없이 균형 (fable.md /pricing) */}
        <div className="grid gap-4 sm:grid-cols-2">
          {PRODUCTS.map((product) => (
            <Card key={product.name} className="gap-4 p-6">
              <div>
                <h3 className="text-base font-bold">{product.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {product.tagline}
                </p>
              </div>
              <div className="mt-auto space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">노출 위치</p>
                  <p className="mt-0.5 text-sm font-medium">{product.where}</p>
                </div>
                <Badge variant="secondary">가격 문의</Badge>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 노출 위치 미리보기 — 목록에서 어디에 뜨는지 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">노출 위치 미리보기</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            공고 목록에서 상품별로 이렇게 보여요.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-[minmax(0,300px)_1fr] md:items-start">
          {/* 목록 와이어프레임 */}
          <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5">
              <p className="text-[11px] font-bold">대표광고 · 추천</p>
              <div className="mt-1.5 flex gap-1.5">
                <div className="h-8 flex-1 rounded bg-background shadow-sm" />
                <div className="h-8 flex-1 rounded bg-background shadow-sm" />
                <div className="h-8 flex-1 rounded bg-background shadow-sm" />
              </div>
            </div>
            <div className="rounded-lg border border-primary/25 p-2.5">
              <p className="text-[11px] font-bold">프리미엄 · 상단 고정</p>
              <div className="mt-1.5 space-y-1.5">
                <div className="h-5 rounded bg-background shadow-sm" />
                <div className="h-5 rounded bg-background shadow-sm" />
              </div>
            </div>
            <div className="p-2.5">
              <p className="text-[11px] text-muted-foreground">일반 공고</p>
              <div className="mt-1.5 space-y-1.5">
                <div className="h-5 rounded bg-muted" />
                <div className="h-5 rounded bg-muted" />
                <div className="h-5 rounded bg-muted" />
              </div>
            </div>
          </div>
          {/* 설명 */}
          <ul className="space-y-3 text-sm leading-relaxed">
            <li>
              <b>대표광고</b> — 홈·공고 목록 최상단 추천 슬롯에 크게. 주목도 최고.
            </li>
            <li>
              <b>프리미엄</b> — 공고 목록 상단에 고정 + 강조 배지.
            </li>
          </ul>
        </div>
      </section>

      {/* 이용 방법 */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">이용 방법</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-lg border p-4">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <p className="mt-3 font-semibold">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">자주 묻는 질문</h2>
        <div className="space-y-2">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group rounded-lg border">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      {/* TODO(design): ❓ CTA 밴드를 홈 사이드바 교회 CTA와 같은 딥그린 면(bg-primary + 흰 버튼)으로
          통일할지 — 정적 페이지의 조용한 톤과 긴장, 사람 판단 필요 (fable.md #6) */}
      <section className="space-y-4 rounded-xl border bg-muted/30 p-8 text-center">
        <div>
          <h2 className="text-lg font-bold">공고를 등록하고 노출을 시작하세요</h2>
          <p className="mt-1 text-sm text-muted-foreground">등록은 무료 · 노출 상품은 선택</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/jobs/new" className={cn(buttonVariants({ size: "lg" }))}>
            공고 등록하기
          </Link>
          <a
            href="mailto:contact@minjob.kr?subject=공고 노출 문의"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            노출 문의
          </a>
        </div>
      </section>
    </div>
  );
}
