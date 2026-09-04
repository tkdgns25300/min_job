import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { getCoverageStats } from "@/lib/queries/jobs";
import { cn } from "@/lib/utils";
import { BUSINESS_INFO, contactMailto } from "@/constants/business";

export const metadata: Metadata = {
  title: "소개 | 민잡",
  description:
    "민잡은 여러 신학교·교단 게시판에 흩어진 교회 사역자 청빙 공고를 한 곳에 모아, 지역·교단·직분·부서로 찾아볼 수 있게 정리하는 서비스입니다.",
  alternates: { canonical: "/about" },
};

// 페이지 카피 — 도메인 값 아님(화면 문구). 유지보수 위해 배열로.
// ⚠️ "반복되는 자리도 보입니다"(재공고 이력)는 뺐다(2026-08-31) — 재공고 추적이 보류(ROADMAP 1-4)라
//    사실이 아니었고, "조건" 같은 표현은 세상적이라 피한다(운영자 — 교회 시장 정서, ROADMAP 톤 항목).
// ⚠️ 두 항목의 **어미를 하나로 맞춘다**(운영자 2026-09-05) — 나란히 읽히는 두 줄이라 하나만
//    다른 말투면 그게 먼저 보인다. 지금은 둘 다 "~할 수 있습니다"다.
const BENEFITS = [
  {
    title: "여기저기 돌아다니지 않아도 됩니다",
    body: "여러 게시판에 흩어진 청빙 공고를 한 곳에서 확인할 수 있습니다.",
  },
  {
    title: "원하는 자리만 편리하게",
    body: "지역·교단·직분·부서로 걸러, 필요한 공고만 골라볼 수 있습니다.",
  },
] as const;

// 공고가 오르는 두 경로 — **직접 등록이 먼저다**(운영자 결정 2026-08-31: 지향점이라 순서가 말하게 한다).
// 단 비중 주장("대부분 직접 등록")은 쓰지 않는다 — 사실이 아니다. 정리 경로 문구는 크롤링·자동화 같은
// 단어 없이 "직접 모아 정리"로 말하되(운영자 결정), 요약+원문 링크는 가드레일 #1의 방어선이라 꼭 남긴다.
const PATHS = [
  {
    title: "교회가 직접 올립니다",
    note: "등록 무료",
    body: "교회 인증을 마친 교회가 공고를 직접 등록하고, 수정·마감까지 직접 관리합니다.",
    featured: true, // 지향점인 경로만 브랜드 톤으로 — pricing의 `highlight`와 같은 관례
  },
  {
    title: "공개된 공고를 정리해 올립니다",
    note: null,
    body: "총회·신학교·교단 게시판에 공개된 청빙 공고를 저희가 직접 모아 지역·사례비·제출 서류 같은 항목으로 정리합니다. 모든 공고에 원문 링크를 함께 둡니다.",
    featured: false,
  },
] as const;

// FAQ 답변에서 쓰는 문의 링크 — 행동("알려 주세요")을 요구하는 답은 연락 수단을 그 자리에 품는다.
// 독립 "문의" 섹션이 사라져서(교회 카드로 흡수) 링크 없이는 답이 갈 곳을 말하지 않게 된다(리뷰 2026-08-31).
function MailLink({ subject }: { subject: string }) {
  return (
    <a
      href={contactMailto(subject)}
      className="font-medium text-foreground underline underline-offset-4"
    >
      {BUSINESS_INFO.email}
    </a>
  );
}

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "민잡은 무료인가요?",
    a: "청빙 자리를 찾는 교역자는 열람·검색을 무료로 이용합니다. 교회의 공고 등록도 무료입니다.",
  },
  {
    q: "공고는 어떻게 올라오나요?",
    // ⚠️ "운영자가 검수·정리해"였다 — 수집 공고 중 확인할 것이 없는 건은 사람을 거치지 않으므로
    //    "검수"를 뺐다(2026-08-21). 구조화(정리)는 실제로 한다.
    a: "교회가 직접 등록하거나, 여러 곳에 공개된 청빙 공고를 정리해 요약과 원문 출처 링크로 안내합니다.",
  },
  {
    q: "공고 내용이 원문과 다르면 어떻게 하나요?",
    a: (
      <>
        모든 공고에 원문 링크가 있으니 지원 전에 원문을 함께 확인해 주세요. 잘못된 내용은{" "}
        <MailLink subject="공고 수정 요청" />로 알려 주시면 수정하겠습니다.
      </>
    ),
  },
  // ⛔ "우리 교회 공고를 내리고 싶어요" 항목은 뺐다(운영자 2026-09-01) — 수정·삭제 요청 안내는
  //    문의 페이지(ROADMAP 문의 접수 폼)가 생기면 그쪽이 맡는다. opt-out 자체(가드레일 #1)는 계속
  //    이행한다 — 그때까지는 위 "원문과 다르면" 답의 이메일과 푸터 문의가 경로다.
  {
    q: "지원은 민잡에서 하나요?",
    a: "사이트 안에서 지원을 받지 않습니다. 교회의 공개 접수처나 원문으로 안내해 드립니다.",
  },
  {
    q: "어느 교단·지역을 다루나요?",
    a: "특정 교단에 한정하지 않는 한국 개신교 교역자 청빙 전반입니다. 초기에는 예장합동·통합을 중심으로 넓혀가고 있습니다.",
  },
];

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-card p-5 text-center">
      <div className="text-2xl font-bold tabular-nums text-primary">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// 재구성 2026-08-31 — 8→6섹션. "이런 분들께"(히어로·교회 카드와 중복)와 독립 "문의"(푸터·교회 카드가
// 맡음)를 접고, "공고는 이렇게 모입니다"(두 경로)와 "교회 담당자" 카드(인증 CTA + 수정·삭제 요청 =
// opt-out 경로)를 신설했다. 구성 근거는 ROADMAP 소개 항목.
// 2026-09-05 "왜 만들었나요"를 더해 7섹션 — 이득(무엇이 좋은가) 다음에 동기(왜 만들었나)가 오고,
// 그다음이 방법(어떻게 모이나)이다.
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
            청빙 공고를 한 곳에서 확인하세요.
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

        {/* 왜 만들었나요 — 만든 사람의 동기·신앙 배경과 이단 거절 원칙(운영자 요청 2026-09-05).
            1인 신규 서비스라 "누가 왜 만들었나"가 기능 설명보다 신뢰를 만든다. 이 페이지에서 유일하게
            **1인칭("저")**을 쓰는 구획이다 — 나머지는 "저희"다. 목소리가 바뀌는 것이 이 절의 요점이라
            다른 절로 번지지 않게 한다.
            ⚠️ **사실만 적는다** — 가족·교단은 실제이고, 이단 거절과 실체 확인도 실제로 하는 일이다
               (가드레일 #1의 크롤러 자동 거절 · 교회 인증 증빙 서류). 규모·성과를 부풀리는 문장은 넣지
               않는다. 제3자의 이름·연락처는 쓰지 않고 관계만 말한다.
            ⚠️ 신고 링크가 문장 안에 있는 이유는 FAQ의 "원문과 다르면"과 같다 — 행동을 요구하는 문장은
               연락 수단을 그 자리에 품는다. */}
        <section>
          <h2 className="mb-5 text-xl font-bold">왜 만들었나요</h2>
          <div className="space-y-4 leading-relaxed break-keep text-muted-foreground">
            <p>
              아버지와 누나가 사역자로 섬기고 있습니다. 두 분이 사역지를 찾고, 교회가 함께할
              사역자를 찾는 과정을 가까이서 지켜봤습니다. 공고는 여러 게시판에 나뉘어 있고, 사례비나
              부서처럼 먼저 알아야 할 것들은 글을 하나하나 열어봐야 알 수 있었습니다.
            </p>
            <p>
              저는 예장합동 교단에 속한 교회에 출석하고 있습니다. 청빙이 교회와 사역자 모두에게
              기도로 결정하는 일임을 알기에, 그 결정에 필요한 것들을 한자리에 모으려고 만들었습니다.
            </p>
            <p>
              <span className="font-semibold text-foreground">
                이단·사이비 공고는 단호히 거절합니다.
              </span>{" "}
              공고를 모으는 단계에서 이단으로 알려진 교단·단체의 글은 걸러내고, 교회가 직접 등록할
              때도 고유번호증·사업자등록증으로 실체를 확인합니다. 그래도 걸러지지 않은 공고를
              보셨다면 <MailLink subject="이단 의심 공고 신고" />로 알려 주세요. 확인 후
              내리겠습니다.
            </p>
          </div>
        </section>

        {/* 공고는 이렇게 모입니다 — 두 경로. 첫 카드(직접 등록)만 브랜드 톤으로 힘을 준다 */}
        <section>
          <h2 className="mb-2 text-xl font-bold">공고는 이렇게 모입니다</h2>
          <p className="mb-5 break-keep text-muted-foreground">
            공고가 민잡에 실리는 방법은 두 가지입니다.
          </p>
          <div className="space-y-3.5">
            {PATHS.map((p, i) => (
              <div
                key={p.title}
                className={cn(
                  "flex gap-4 rounded-2xl border p-5 sm:p-6",
                  p.featured && "border-primary/25 bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold",
                    p.featured
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-bold">
                    {p.title}
                    {p.note && (
                      <span className="ml-2 text-xs font-bold text-primary">{p.note}</span>
                    )}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed break-keep text-muted-foreground">
                    {p.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 현재 등록 현황 — 실 데이터 집계(getCoverageStats · fabricate 없음). 공고 → 지역 → 교회 3수치,
            교단은 뺐다(운영자 2026-09-01 — 10이라는 숫자가 폭을 말해주지 못한다) */}
        <section>
          <h2 className="mb-5 text-xl font-bold">현재 등록 현황</h2>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border bg-border">
            <Stat value={stats.openCount} label="모집 중 공고" />
            <Stat value={stats.regionCount} label="지역" />
            <Stat value={stats.churchCount} label="교회" />
          </div>
        </section>

        {/* 교회 담당자 — 인증 CTA 하나로. "이미 올라온 공고의 수정·삭제" 안내는 뺐다(운영자 2026-09-01 —
            문의 페이지가 생기면 그쪽이 맡는다). 마이페이지 인증 유도 카드와 같은 결 */}
        <section className="rounded-2xl bg-brand-900 px-6 py-10 text-white sm:px-10 sm:py-12">
          <p className="text-[11px] font-bold text-gold">교회 담당자이신가요?</p>
          <h2 className="mt-2 text-xl font-bold break-keep sm:text-2xl">
            우리 교회 공고, 직접 올리고 관리하세요
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed break-keep text-white/70">
            교회 인증(고유번호증·사업자등록증)을 마치면 공고를 직접 등록·수정·마감할 수 있습니다.
            등록은 무료입니다.
          </p>
          <Link
            href="/mypage/verify"
            className="mt-7 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-white/90"
          >
            교회 인증하기 →
          </Link>
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
