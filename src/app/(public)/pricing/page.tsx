import type { Metadata } from "next";
import Link from "next/link";
import { getCoverageStats } from "@/lib/queries/jobs";
import { PreviewButton } from "@/components/pricing/exposure-preview";
import { BUSINESS_INFO, contactMailto } from "@/constants/business";
import {
  EXPOSURE_PRODUCTS,
  EXPOSURE_SLOTS,
  exposurePrice,
  type ExposureProduct,
  type ExposureSlot,
  type ExposureWeeks,
} from "@/constants/domain";
import { formatExposurePrice } from "@/lib/format";
import type { Group } from "@/components/pricing/exposure-scenes";

// 가격은 `EXPOSURE_PRODUCTS`(원 단위)에서만 읽는다 — 여기 숫자를 적으면 결제 금액과 갈린다
const price = (tier: ExposureProduct, weeks: ExposureWeeks) =>
  formatExposurePrice(exposurePrice(tier, weeks));

export const metadata: Metadata = {
  title: "공고 노출 안내",
  description:
    "무료로 공고를 올리고, 더 많은 사역자에게 빠르게 닿고 싶을 때만 노출을 더하세요. 기본·플러스·스페셜 노출 상품 안내.",
  alternates: { canonical: "/pricing" },
};

// 자리 → 카드에 적는 말. 자리 이름(`EXPOSURE_SLOTS`)보다 한 마디 더 — 어디에 어떻게 서는지
const SLOT_FEATURE: Record<ExposureSlot, string> = {
  home: "홈 첫 화면 추천 청빙 카드(3칸)",
  list: "공고 목록 1페이지 맨 위 로우",
  related: "비슷한 공고 상단 3칸 — 같은 지역 공고 상세마다",
};

// 카드는 사다리 아래부터(기본 → 플러스 → 스페셜) — 왼쪽이 싼 것이 읽기 자연스럽다
const PAID_TIERS = (Object.keys(EXPOSURE_PRODUCTS) as ExposureProduct[]).reverse();
const PREVIEW_GROUP: Record<ExposureProduct, Group> = {
  BASIC: "basic",
  PLUS: "plus",
  SPECIAL: "special",
};

const PLAN_AUDIENCE: Record<ExposureProduct, string> = {
  BASIC: "이 지역에서 찾는 사역자에게 — 가볍게 한 번",
  PLUS: "목록을 훑는 사역자에게 — 맨 위에서 먼저",
  SPECIAL: "가장 크게 알리고 싶을 때 — 첫 화면부터",
};

interface Plan {
  name: string;
  price: string;
  unit: string;
  aud: string;
  features: string[];
  cta: { label: string; href: string; primary: boolean };
  highlight: boolean;
  badge?: string;
  preview?: Group;
}

function paidPlan(tier: ExposureProduct): Plan {
  const p = EXPOSURE_PRODUCTS[tier];
  const slots = (Object.keys(EXPOSURE_SLOTS) as ExposureSlot[])
    .filter((slot) => p.slots[slot])
    .map((slot) => SLOT_FEATURE[slot]);
  return {
    name: p.label,
    price: price(tier, 1),
    unit: "/ 주",
    aud: PLAN_AUDIENCE[tier],
    features: [
      ...slots,
      p.capacity === null ? "정원 없음 — 바로 시작" : `동시 ${p.capacity}건 한정`,
      `2주 ${price(tier, 2)} · 4주 ${price(tier, 4)}`,
    ],
    // 결제 화면이 게이트를 맡는다 — 비로그인은 proxy가 로그인으로, 미인증 교회는 대시보드(인증 안내)로 보낸다.
    // 그래서 이 정적 페이지가 세션을 읽지 않아도 CTA 하나로 충분하다(PPR 셸 유지)
    cta: { label: "노출 신청하기", href: "/mypage/church/promote", primary: true },
    highlight: tier === "PLUS",
    badge: tier === "PLUS" ? "추천" : tier === "SPECIAL" ? "동시 3건 한정" : undefined,
    preview: PREVIEW_GROUP[tier],
  };
}

// 상품 카드 — 무료 + 유료 3등급. 유료 카드의 문구는 도메인 상수에서 파생한다(위 paidPlan)
const PLANS: Plan[] = [
  {
    name: "무료 공고",
    price: "무료",
    unit: "",
    aud: "모든 교회 — 먼저 공고를 올려보세요",
    features: ["공고 등록·수정", "최신순 목록·검색 노출", "교회 페이지·지난 공고 이력"],
    cta: { label: "공고 등록", href: "/jobs/new", primary: false },
    highlight: false,
  },
  ...PAID_TIERS.map(paidPlan),
];

const FAQS = [
  {
    q: "결제는 어떻게 하나요?",
    a: "교회 인증을 마친 계정으로 노출 신청 화면에서 카드로 결제해요. 결제가 확인되면 고른 시작일부터 노출돼요(오늘을 고르면 바로). 인증이 아직이면 먼저 교회 인증을 진행해 주세요.",
  },
  {
    q: "무료 공고도 노출되나요?",
    a: "네. 무료 공고는 최신순 목록·검색에 노출됩니다. 유료 상품은 홈 추천·목록 맨 위·비슷한 공고 상단처럼 더 눈에 띄는 자리를 더하는 것입니다.",
  },
  {
    q: "노출 기간과 정원은요?",
    a: "시작일을 오늘부터 일주일 안에서 고르고, 그날부터 1·2·4주 중 고릅니다. 자리가 한정이라 스페셜은 동시에 3건, 플러스는 2건까지만 노출돼요. 원하는 날이 찼으면 다른 날짜로 시작할 수 있어요.",
  },
  {
    q: "취소·환불은요?",
    a: "게재 시작 전에는 전액 환불해 드려요. 게재가 시작된 뒤에는 남은 일수만큼 일할 계산해 환불해 드리며, 이메일로 요청하시면 접수일 기준으로 3영업일 이내에 처리해요.",
  },
  {
    q: "지원도 민잡에서 받나요?",
    a: "아니요. 지원은 교회의 공개 접수처나 원문으로 안내합니다.",
  },
] as const;

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-card p-5 ${
        plan.highlight
          ? "border-[1.5px] border-primary shadow-lg shadow-primary/5"
          : "border-border"
      }`}
    >
      {plan.badge ? (
        <span className="absolute -top-3 left-5 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
          {plan.badge}
        </span>
      ) : null}
      <div className="font-bold">{plan.name}</div>
      <div
        className={`mt-2 text-2xl font-bold ${plan.price === "무료" ? "text-foreground" : "text-primary"}`}
      >
        {plan.price}
        {plan.unit && (
          <span className="text-sm font-semibold text-muted-foreground"> {plan.unit}</span>
        )}
      </div>
      <p className="mt-1 min-h-8 text-xs break-keep text-muted-foreground">{plan.aud}</p>
      <ul className="mt-3.5 flex flex-1 flex-col gap-2 border-t pt-3.5">
        {plan.features.map((f) => (
          <li key={f} className="relative pl-4.5 text-sm break-keep">
            <span className="absolute left-0 font-bold text-primary">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={plan.cta.href}
        className={`mt-4 rounded-xl px-4 py-2.5 text-center text-sm font-bold transition-colors ${
          plan.cta.primary
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border border-primary/30 text-primary hover:bg-primary/5"
        }`}
      >
        {plan.cta.label}
      </Link>
      {plan.cta.primary && (
        <div className="mt-2 text-center text-[11px] text-muted-foreground">VAT 포함</div>
      )}
      {plan.preview ? <PreviewButton group={plan.preview} /> : null}
    </div>
  );
}

function Yes() {
  return <span className="font-bold text-primary">✓</span>;
}
function No() {
  return <span className="text-border">–</span>;
}

export default async function PricingPage() {
  const stats = await getCoverageStats();

  return (
    <>
      {/* 히어로 */}
      <section className="bg-hero text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-16">
          <p className="text-sm font-semibold text-gold">공고 노출 안내</p>
          <h1 className="mt-3 text-2xl leading-snug font-extrabold tracking-[-0.02em] break-keep sm:text-3xl">
            공고를 더 많은 사역자에게 알리세요
          </h1>
          <p className="mt-3.5 max-w-xl leading-relaxed break-keep text-white/80">
            무료로 공고를 올리고, 노출을 더하세요. 각 상품에서 실제 노출 화면을 미리 볼 수 있어요.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl space-y-14 px-4 pt-12 pb-24">
        {/* 상품 카드 */}
        {/* 네 카드 높이를 맞춘다(운영자 요청 2026-09-05) — `items-start`를 두면 내용 길이대로 들쭉날쭉해진다.
            카드 안에서는 기능 목록이 남는 높이를 먹어 CTA가 같은 줄에 선다(`PlanCard`의 `flex-1`). */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </section>

        {/* 비교표 — 행은 자리(`EXPOSURE_SLOTS`), 열은 무료 + 유료 3등급. 상품 정의에서 그대로 그린다 */}
        <section>
          <h2 className="mb-5 text-xl font-bold">한눈에 비교</h2>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary/5">
                  <th className="p-3 text-left font-semibold text-muted-foreground">노출 자리</th>
                  <th className="p-3 font-bold">무료</th>
                  {PAID_TIERS.map((tier) => (
                    <th key={tier} className="p-3 font-bold text-primary">
                      {EXPOSURE_PRODUCTS[tier].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:p-3 [&_td]:text-center [&_td:first-child]:text-left [&_td:first-child]:font-medium [&_td:first-child]:text-muted-foreground">
                <tr>
                  <td>최신순 목록·검색</td>
                  <td>
                    <Yes />
                  </td>
                  {PAID_TIERS.map((tier) => (
                    <td key={tier}>
                      <Yes />
                    </td>
                  ))}
                </tr>
                {(Object.keys(EXPOSURE_SLOTS) as ExposureSlot[]).map((slot) => (
                  <tr key={slot}>
                    <td>{EXPOSURE_SLOTS[slot]}</td>
                    <td>
                      <No />
                    </td>
                    {PAID_TIERS.map((tier) => (
                      <td key={tier}>{EXPOSURE_PRODUCTS[tier].slots[slot] ? <Yes /> : <No />}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td>동시 정원</td>
                  <td>
                    <No />
                  </td>
                  {PAID_TIERS.map((tier) => {
                    const capacity = EXPOSURE_PRODUCTS[tier].capacity;
                    return <td key={tier}>{capacity === null ? "없음" : `${capacity}건`}</td>;
                  })}
                </tr>
                <tr className="font-bold [&_td]:text-foreground">
                  <td>1주</td>
                  <td>0원</td>
                  {PAID_TIERS.map((tier) => (
                    <td key={tier}>{price(tier, 1)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            ※ 표시가는 VAT 포함. 고른 시작일부터 주 단위 · 2주·4주 묶음가. 유료 자리에는 “광고”라고
            표시돼요.
          </p>
        </section>

        {/* 신뢰 */}
        <section>
          <h2 className="mb-5 text-xl font-bold">믿고 노출하세요</h2>
          <div className="grid grid-cols-4 gap-px overflow-hidden rounded-2xl border bg-border">
            {[
              { v: stats.openCount, k: "청빙 공고" },
              { v: stats.churchCount, k: "교회" },
              { v: stats.regionCount, k: "지역" },
              { v: stats.denominationCount, k: "교단" },
            ].map((s) => (
              <div key={s.k} className="bg-card p-4 text-center">
                <div className="text-xl font-bold tabular-nums text-primary">{s.v}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.k}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm">
            <span>
              {/* ⚠️ "모든 공고 운영자 검수"였다 — 공고 전수 검수를 하지 않기로 해(2026-08-21)
                  거짓이 됐다. 유료 상품 페이지의 신뢰 문구라 사실인 것만 적는다: 등록 자격은
                  교회 인증(증빙 + 운영자 승인)이 막는다. */}
              <b className="text-primary">✓ 인증된 교회만 등록</b>
            </span>
            <span className="text-muted-foreground">VAT 포함</span>
          </div>
        </section>

        {/* 문의 — 이메일 하나만. 그전엔 폼(교회명·연락처·상품·내용)처럼 보였는데 실제로는 `mailto`를 여는 것뿐이라
            "문의 보내기"를 누르면 접수된 줄 알기 쉬웠다(운영자 2026-09-05). 문의는 이메일로만 받기로 한 결정
            (2026-08-31)과도 맞는다. */}
        <section id="contact" className="scroll-mt-20 rounded-2xl border bg-card p-5">
          <h2 className="text-xl font-bold">노출 문의</h2>
          <p className="mt-1.5 text-sm leading-relaxed break-keep text-muted-foreground">
            결제 전에 상품·기간이 궁금하거나 세금계산서가 필요하면 이메일로 보내 주세요. 영업일 기준
            1일 안에 답해 드려요.
          </p>
          <a
            href={contactMailto("노출 상품 문의")}
            className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
          >
            {BUSINESS_INFO.email}
          </a>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="mb-5 text-xl font-bold">자주 묻는 질문</h2>
          <div className="border-t">
            {FAQS.map((f) => (
              <div key={f.q} className="border-b py-4">
                <h3 className="font-semibold">{f.q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed break-keep text-muted-foreground">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
