"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import * as PortOne from "@portone/browser-sdk/v2";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { formatExposurePrice } from "@/lib/format";
import { contactMailto } from "@/constants/business";
import { STORAGE_KEYS } from "@/constants/storage";
import {
  EXPOSURE_PRODUCTS,
  EXPOSURE_WEEKS,
  exposurePrice,
  type ExposureProduct,
  type ExposureWeeks,
} from "@/constants/domain";
import {
  daysOf,
  findClash,
  firstFullDay,
  promotionPeriod,
  soldOn,
  type CapacitySpan,
  type PromotionPeriod,
} from "@/lib/exposure-order";
import { addDays } from "@/lib/job-visibility";
import { completePromotion, type PromotionOrder, type PromotionResult } from "./actions";
import { PromoteOutcome } from "./promote-outcome";

// 노출 결제 화면 — 공고 · 등급 · 시작일 · 기간을 고르고 PortOne 결제창을 띄운다.
// 정원·겹침 판정은 `lib/exposure-order`(순수)를 **화면과 완료 액션이 같이 쓴다** — 화면은 안내, 액션이 최종.
// 결제번호는 결제창을 띄우기 **전에** localStorage에 남긴다 — 완료 처리 전에 탭이 닫히거나 세션이 풀리거나
// 모바일에서 돌아오지 못해도, 이 화면을 다시 열면 그 번호로 확인을 이어간다(액션은 멱등).
//
// PortOne 공개 값 — **실연동 채널**("MinJob NHN KCP" kcp_v2). 카드가 실제로 청구된다. 미설정이면 안내만 뜬다.
const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
const CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

type JobOption = { id: string; title: string };
type Outcome = { result: PromotionResult; paymentId: string };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
/** "2026-09-06" → "9/6" — 이 화면의 날짜 표기 */
const monthDay = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const range = (period: PromotionPeriod) =>
  `${monthDay(period.startsAt)}~${monthDay(period.endsAt)}`;
/** 요일 — 정오 UTC 기준이라 브라우저 시간대와 무관하게 서버와 같은 답이 나온다 */
const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];

const rememberPayment = (paymentId: string | null) => {
  try {
    if (paymentId) window.localStorage.setItem(STORAGE_KEYS.pendingPromotionPayment, paymentId);
    else window.localStorage.removeItem(STORAGE_KEYS.pendingPromotionPayment);
  } catch {}
};

export function PromoteCheckout({
  jobs,
  payerEmail,
  testPricing,
  today,
  startDates,
  spans,
  held,
  initialError,
}: {
  jobs: JobOption[];
  payerEmail: string;
  /** ⏳ 운영자 실결제 점검용 임시 가격을 쓸지 — 서버가 판정해 내려준다(`constants/domain`) */
  testPricing: boolean;
  /** KST 오늘(YYYY-MM-DD) — 서버가 만든다(클라이언트 시계를 믿지 않는다) */
  today: string;
  /** 고를 수 있는 시작일 — 오늘부터 7일 */
  startDates: string[];
  /** 정원 판정용 기간 조각 — 누가 샀는지는 없다 */
  spans: CapacitySpan[];
  /** 이 교회 공고에 이미 잡힌 기간 — 겹치면 못 산다 */
  held: Record<string, PromotionPeriod[]>;
  /** 모바일 복귀가 `?code=`를 달고 왔을 때의 결제창 사유(청구 없음) */
  initialError?: string | null;
}) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [tier, setTier] = useState<ExposureProduct>("PLUS");
  const [weeks, setWeeks] = useState<ExposureWeeks>(1);
  const [startsAt, setStartsAt] = useState(startDates[0] ?? today);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // 지난번 결제창의 번호가 남아 있으면 그 결과부터 — 완료 처리가 끊긴 결제를 잃지 않게(마운트 1회)
  useEffect(() => {
    let remembered: string | null = null;
    try {
      remembered = window.localStorage.getItem(STORAGE_KEYS.pendingPromotionPayment);
    } catch {}
    if (!remembered) return;
    const paymentId = remembered;
    startTransition(async () => {
      try {
        setOutcome({ result: await completePromotion(paymentId), paymentId });
      } catch (thrown) {
        unstable_rethrow(thrown);
        console.error("[promote] 이어서 확인 실패", thrown);
        setOutcome({
          result: { ok: false, message: "결제 확인 중 오류가 발생했어요.", charged: true },
          paymentId,
        });
      }
      rememberPayment(null);
    });
  }, []);

  // 선택이 바뀌면 지난 결제창의 실패 문구는 치운다 — 새 막힘 이유(매진·겹침)를 가리면 안 된다
  const choose =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setError(null);
    };

  const product = EXPOSURE_PRODUCTS[tier];
  const amount = exposurePrice(tier, weeks, testPricing);
  const period = promotionPeriod(startsAt, weeks);

  /** 고른 기간 내내 남는 자리 — 하루라도 찬 날이 있으면 그 하루가 상한이다(정원 없는 등급은 null) */
  const remaining = (key: ExposureProduct): number | null => {
    const capacity = EXPOSURE_PRODUCTS[key].capacity;
    if (capacity === null) return null;
    const busiest = Math.max(...daysOf(period).map((day) => soldOn(key, day, spans)));
    return Math.max(0, capacity - busiest);
  };

  const mine = held[jobId] ?? [];
  const clashWith = (p: PromotionPeriod) => findClash(mine, p);
  const clash = clashWith(period);
  const fullDay = firstFullDay(tier, period, spans);

  // 결제를 막는 이유 하나 — 버튼 아래에 그대로 적는다(왜 안 눌리는지 모르는 버튼을 두지 않는다).
  // 겹침은 두 갈래로 답한다: **피할 날짜가 선택지에 있으면** 그렇게 안내하고, 잡힌 노출이 선택지 끝까지
  // 이어져 어느 날을 골라도 겹치면 **언제 다시 오면 되는지**를 말한다(막다른 안내를 두지 않는다).
  const blocker = clash
    ? startDates.some((d) => !clashWith(promotionPeriod(d, weeks)))
      ? `이 공고는 ${range(clash)}에 이미 노출이 잡혀 있어요. 그 기간을 피해 골라 주세요.`
      : `이 공고는 ${range(clash)}에 노출이 잡혀 있어요. 끝나는 ${monthDay(addDays(clash.endsAt, 1))}부터 다시 신청할 수 있어요.`
    : fullDay !== null
      ? `${monthDay(fullDay)}에 ${product.label} 자리가 다 찼어요. 다른 날짜나 기간을 골라 주세요.`
      : null;

  function pay() {
    if (!agreed || blocker !== null || busy) return;
    if (!STORE_ID || !CHANNEL_KEY) {
      setError("결제 연동 키가 아직 설정되지 않았어요. PortOne 키 입력 후 이용할 수 있어요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      // KCP V2 주문번호 최대 40자 — UUID 하이픈 제거해 38자로(promo- 6 + 32). 형식은 완료 액션이 확인한다
      const paymentId = `promo-${crypto.randomUUID().replace(/-/g, "")}`;
      const order: PromotionOrder = { jobId, tier, weeks, startsAt };
      rememberPayment(paymentId);
      try {
        const res = await PortOne.requestPayment({
          storeId: STORE_ID,
          channelKey: CHANNEL_KEY,
          paymentId,
          orderName: `${product.label} 노출 ${weeks}주`,
          totalAmount: amount,
          currency: "CURRENCY_KRW",
          payMethod: "CARD",
          // 주문은 결제 레코드에 실린다 — 완료 액션이 PortOne에서 다시 읽는다(모바일 복귀 뒤에도 같은 답)
          customData: order,
          customer: { email: payerEmail },
          // 모바일은 결제사 페이지로 넘어갔다가 여기로 돌아온다 — `?paymentId=`를 페이지가 받아 완료를 이어간다
          redirectUrl: `${window.location.origin}/mypage/church/promote`,
        });
        if (res?.code != null) {
          // 결제창에서 취소·실패 — 청구가 일어나지 않았으므로 다시 시도해도 안전하다
          rememberPayment(null);
          setError(res.message ?? "결제가 취소되었거나 실패했어요.");
          return;
        }
        setOutcome({ result: await completePromotion(paymentId), paymentId });
        rememberPayment(null);
      } catch (thrown) {
        unstable_rethrow(thrown);
        console.error("[promote] 결제 처리 실패", thrown);
        // 결제창을 통과한 뒤 던져진 예외 — 청구는 이미 됐을 수 있다. 재시도로 몰지 않는다
        setOutcome({
          result: { ok: false, message: "결제 확인 중 오류가 발생했어요.", charged: true },
          paymentId,
        });
      }
    });
  }

  if (outcome) return <PromoteOutcome result={outcome.result} paymentId={outcome.paymentId} />;

  if (jobs.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed p-8 text-center">
        <p className="text-sm break-keep text-muted-foreground">
          노출할 게재 중 공고가 없어요. 먼저 공고를 등록·게재해 주세요.
        </p>
        <Link href="/jobs/new" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
          공고 등록하기
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6 rounded-2xl border bg-card p-5 sm:p-6">
      <section>
        <h2 className="mb-2.5 text-sm font-bold">대상 공고</h2>
        <NativeSelect
          value={jobId}
          onChange={(e) => choose(setJobId)(e.target.value)}
          aria-label="대상 공고"
          className="h-11"
        >
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </NativeSelect>
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-bold">노출 상품</h2>
        <div className="space-y-2.5">
          {(Object.keys(EXPOSURE_PRODUCTS) as ExposureProduct[]).map((key) => {
            const p = EXPOSURE_PRODUCTS[key];
            const on = tier === key;
            const left = remaining(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => choose(setTier)(key)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border-[1.5px] p-4 text-left transition-colors",
                  on ? "border-primary bg-primary/[0.06]" : "border-border hover:border-primary",
                )}
              >
                <span
                  className={cn(
                    "relative mt-0.5 size-[18px] shrink-0 rounded-full border-2",
                    on ? "border-primary" : "border-input",
                  )}
                >
                  {on && <span className="absolute inset-[3px] rounded-full bg-primary" />}
                </span>
                <span className="flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-bold">{p.label}</span>
                    <span className="text-[15px] font-bold text-gold-ink">
                      주 {formatExposurePrice(exposurePrice(key, 1, testPricing))}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs break-keep text-muted-foreground">
                    {p.desc}
                  </span>
                  {/* 남은 자리는 **고른 기간 기준**이다 — 날짜나 주수를 바꾸면 이 숫자도 바뀐다 */}
                  {left !== null ? (
                    <span
                      className={cn(
                        "mt-1 block text-xs font-semibold",
                        left > 0 ? "text-primary" : "text-destructive",
                      )}
                    >
                      {left > 0
                        ? `${range(period)} 남은 자리 ${left}/${p.capacity}`
                        : `${range(period)} 매진`}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-bold">시작일</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {startDates.map((date, i) => {
            const on = startsAt === date;
            return (
              <button
                key={date}
                type="button"
                onClick={() => choose(setStartsAt)(date)}
                aria-pressed={on}
                className={cn(
                  "rounded-lg border py-2 text-center text-sm font-bold transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary",
                )}
              >
                {monthDay(date)}
                <span className="block text-[11px] font-medium opacity-80">
                  {i === 0 ? "오늘" : `${weekday(date)}요일`}
                </span>
                {/* 화면은 "9/10"이지만 스크린리더는 "9 슬래시 10"으로 읽는다 — 날짜를 말로 붙여 준다 */}
                <span className="sr-only">
                  {`${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 ${weekday(date)}요일 시작`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs break-keep text-muted-foreground">
          고른 날부터 주 단위로 노출돼요. 오늘부터 일주일 안에서 시작일을 정할 수 있어요.
        </p>
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-bold">노출 기간</h2>
        <div className="flex gap-2">
          {EXPOSURE_WEEKS.map((w) => {
            const on = weeks === w;
            return (
              <button
                key={w}
                type="button"
                onClick={() => choose(setWeeks)(w)}
                aria-pressed={on}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2.5 text-sm font-bold transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary",
                )}
              >
                {w}주
                <span className="block text-[11px] font-medium opacity-80">
                  {formatExposurePrice(exposurePrice(tier, w, testPricing))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-bold">결제 요약</h2>
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {product.label} · {weeks}주 · {range(period)}
            </span>
            <span>{won(amount)}</span>
          </div>
          <hr className="my-3 border-border" />
          <div className="flex items-baseline justify-between font-bold">
            <span>합계</span>
            <span className="text-xl">{won(amount)}</span>
          </div>
          <p className="mt-1 text-right text-[11px] text-muted-foreground">VAT 포함</p>
        </div>
      </section>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 size-[18px] shrink-0 accent-primary"
        />
        <span className="break-keep">
          (필수){" "}
          <Link href="/terms" className="underline" target="_blank">
            이용약관
          </Link>{" "}
          및 취소·환불 규정을 확인했으며 결제에 동의합니다.
        </span>
      </label>

      {/* 결제창이 돌려준 실패는 **방금 일어난 일**이라 `role="alert"`로 읽어 준다. 막힘 이유는 처음 그릴 때부터
          있는 안내라 alert가 아니다 — 그 자리에 있으면 스크린리더가 읽지 않고 지나간다 */}
      {error !== null ? (
        <p
          className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm break-keep text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : blocker !== null ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm break-keep text-destructive">
          {blocker}
        </p>
      ) : null}

      <div>
        <Button
          type="button"
          size="lg"
          onClick={pay}
          disabled={!agreed || blocker !== null || busy}
          className="h-13 w-full text-base"
        >
          {busy ? "결제 진행 중…" : `${won(amount)} 결제하기`}
        </Button>
        {/* 환불 기준을 여기 적는 이유: 약관 제10조가 결제 화면과 한 쌍이라, 여기 없으면 "확인했다"는 동의가
            어디에도 없는 규정을 가리키게 된다 */}
        <div className="mt-2.5 space-y-1 text-center text-[11px] leading-relaxed break-keep text-muted-foreground">
          <p>카드가 실제로 청구되고, 결제가 확인되면 노출이 바로 적용돼요.</p>
          <p>
            <b>게재 시작 전에는 전액 환불</b>, 게재가 시작된 뒤에는 환불되지 않아요.{" "}
            <a href={contactMailto("노출 결제 취소·환불 문의")} className="underline">
              취소·환불 문의
            </a>
          </p>
          <p>
            휴대폰에서는 결제 후 이 화면으로 돌아와 적용 결과를 보여드려요. 돌아오지 못했더라도 이
            화면을 다시 열면 결제번호로 확인을 이어가요.
          </p>
        </div>
      </div>
    </div>
  );
}
