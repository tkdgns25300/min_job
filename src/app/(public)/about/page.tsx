import type { Metadata } from "next";
import Link from "next/link";
import { getCoverageStats } from "@/lib/queries/jobs";
import { BUSINESS_INFO, contactMailto } from "@/constants/business";

export const metadata: Metadata = {
  title: "소개 | 민잡",
  description:
    "민잡은 여러 신학교·교단 게시판에 흩어진 교회 사역자 청빙 공고를 한 곳에 모아, 지역·교단·직분·부서로 찾아볼 수 있게 정리하는 서비스입니다.",
  alternates: { canonical: "/about" },
};

// 페이지 카피 — 도메인 값 아님(화면 문구). 유지보수 위해 배열로.
const BENEFITS = [
  {
    title: "여기저기 안 돌아다녀도 됩니다",
    body: "여러 게시판에 흩어진 청빙 공고를 한 곳에서 확인합니다.",
  },
  {
    title: "원하는 조건만 빠르게",
    body: "지역·교단·직분·부서로 걸러, 필요한 공고만 골라 봅니다.",
  },
  {
    title: "반복되는 자리도 보입니다",
    body: "같은 자리가 여러 번 청빙됐는지 지난 이력까지 확인합니다.",
  },
] as const;

const FAQS = [
  {
    q: "민잡은 무료인가요?",
    a: "청빙 자리를 찾는 교역자는 열람·검색을 무료로 이용합니다.",
  },
  {
    q: "공고는 어떻게 올라오나요?",
    // ⚠️ "운영자가 검수·정리해"였다 — 수집 공고 중 확인할 것이 없는 건은 사람을 거치지 않으므로
    //    "검수"를 뺐다(2026-08-21). 구조화(정리)는 실제로 한다.
    a: "교회가 직접 등록하거나, 여러 곳에 공개된 청빙 공고를 정리해 요약과 원문 출처 링크로 안내합니다.",
  },
  {
    q: "지원은 민잡에서 하나요?",
    a: "사이트 안에서 지원을 받지 않습니다. 교회의 공개 접수처나 원문으로 안내해 드립니다.",
  },
  {
    q: "어느 교단·지역을 다루나요?",
    a: "특정 교단에 한정하지 않는 한국 개신교 교역자 청빙 전반입니다. 초기에는 예장합동·통합을 중심으로 넓혀가고 있습니다.",
  },
] as const;

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-card p-5 text-center">
      <div className="text-2xl font-bold tabular-nums text-primary">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default async function AboutPage() {
  const stats = await getCoverageStats();

  return (
    <>
      {/* 히어로 — 풀블리드 딥그린 (헤더와 이어짐) */}
      <section className="bg-hero text-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-20">
          <p className="text-sm font-semibold tracking-wide text-gold">
            교회 사역자 청빙, 한 곳에서
          </p>
          <h1 className="mt-3.5 text-3xl leading-[1.32] font-extrabold tracking-[-0.02em] break-keep sm:text-4xl">
            여기저기 흩어진 청빙 공고를
            <br className="hidden sm:block" /> 한 곳에서 확인하세요.
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed break-keep text-white/75">
            여러 신학교·교단 게시판에 나뉘어 있던 교회 사역자 청빙 공고를 한 곳에 모아,
            지역·교단·직분·부서로 찾아볼 수 있게 정리합니다.
          </p>
          <p className="mt-3.5 font-semibold text-gold">
            부교역자부터 담임까지, 청빙의 길목을 조금 더 밝게.
          </p>
          <Link
            href="/jobs"
            className="mt-7 inline-block rounded-xl bg-white px-6 py-3 font-bold text-primary transition-colors hover:bg-white/90"
          >
            공고 보러 가기
          </Link>
        </div>
      </section>

      <div className="mx-auto w-full max-w-3xl space-y-12 px-4 pt-12 pb-24">
        {/* 무엇이 좋은가요 — 텍스트형(박스 없음) */}
        <section>
          <h2 className="mb-5 text-xl font-bold">무엇이 좋은가요</h2>
          <div className="space-y-6">
            {BENEFITS.map((b, i) => (
              <div key={b.title} className="flex gap-3.5">
                <span className="w-6 shrink-0 pt-0.5 font-bold text-primary/45 tabular-nums">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="font-bold">{b.title}</h3>
                  <p className="mt-1 leading-relaxed break-keep text-muted-foreground">{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 이런 분들께 — 텍스트형 */}
        <section>
          <h2 className="mb-5 text-xl font-bold">이런 분들께</h2>
          <div className="space-y-3">
            <p className="break-keep">
              <span className="font-bold">교역자</span>
              <span className="text-muted-foreground">
                {" "}
                — 청빙 자리를 찾는 분. 조건으로 빠르게 찾습니다.
              </span>
            </p>
            <p className="break-keep">
              <span className="font-bold">교회</span>
              <span className="text-muted-foreground">
                {" "}
                — 함께 사역할 사람을 찾는 곳. 공고를 등록·관리합니다.
              </span>
            </p>
          </div>
        </section>

        {/* 현재 등록 현황 — 실 데이터 집계(getCoverageStats). 유일한 박스 섹션 */}
        <section>
          <h2 className="mb-5 text-xl font-bold">현재 등록 현황</h2>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
            <Stat value={stats.openCount} label="모집 중 공고" />
            <Stat value={stats.churchCount} label="교회" />
            <Stat value={stats.regionCount} label="지역" />
            <Stat value={stats.denominationCount} label="교단" />
          </div>
        </section>

        {/* 자주 묻는 질문 */}
        <section>
          <h2 className="mb-5 text-xl font-bold">자주 묻는 질문</h2>
          <div className="border-t">
            {FAQS.map((f) => (
              <div key={f.q} className="border-b py-4">
                <h3 className="font-semibold">{f.q}</h3>
                <p className="mt-1.5 leading-relaxed break-keep text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 문의 */}
        <section>
          <h2 className="mb-5 text-xl font-bold">문의</h2>
          <div className="rounded-2xl border bg-muted/30 p-5">
            <p className="font-semibold">도움이 필요하신가요?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              서비스 관련 문의는{" "}
              <a href={contactMailto()} className="font-medium text-foreground hover:underline">
                {BUSINESS_INFO.email}
              </a>{" "}
              로 보내 주세요.
            </p>
          </div>
        </section>

        {/* 하단 CTA */}
        <div className="text-center">
          <Link
            href="/jobs"
            className="inline-block rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            공고 보러 가기 →
          </Link>
        </div>
      </div>
    </>
  );
}
