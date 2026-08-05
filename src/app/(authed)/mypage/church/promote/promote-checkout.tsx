"use client";

import { useState } from "react";
import Link from "next/link";
import * as PortOne from "@portone/browser-sdk/v2";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  EXPOSURE_PRODUCTS,
  EXPOSURE_WEEKS,
  exposurePrice,
  type ExposureProduct,
} from "@/constants/domain";

// PortOne 공개 값(테스트 채널). 미설정이면 결제 시도 시 안내만.
const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
const CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

type JobOption = { id: string; title: string };
type Status = "idle" | "processing" | "success" | "error";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export function PromoteCheckout({ jobs }: { jobs: JobOption[] }) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [tier, setTier] = useState<ExposureProduct>("PREMIUM");
  const [weeks, setWeeks] = useState<number>(1);
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const product = EXPOSURE_PRODUCTS[tier];
  const amount = exposurePrice(tier, weeks);

  async function pay() {
    if (!agreed || status === "processing") return;
    if (!STORE_ID || !CHANNEL_KEY) {
      setStatus("error");
      setMessage("결제 연동 키가 아직 설정되지 않았어요. PortOne 키 입력 후 이용할 수 있어요.");
      return;
    }
    setStatus("processing");
    setMessage("");
    try {
      // KCP V2 주문번호 최대 40자 — UUID 하이픈 제거해 38자로(promo- 6 + 32)
      const paymentId = `promo-${crypto.randomUUID().replace(/-/g, "")}`;
      const res = await PortOne.requestPayment({
        storeId: STORE_ID,
        channelKey: CHANNEL_KEY,
        paymentId,
        orderName: `${product.label} 노출 ${weeks}주`,
        totalAmount: amount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        redirectUrl: `${window.location.origin}/mypage/church/promote`,
      });
      if (res?.code != null) {
        setStatus("error");
        setMessage(res.message ?? "결제가 취소되었거나 실패했어요.");
        return;
      }
      // 서버 검증 — 금액은 서버가 tier·weeks로 재계산해 위변조 방지
      const verify = await fetch("/api/payments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, tier, weeks, jobId }),
      });
      const result = (await verify.json()) as { ok: boolean; reason?: string };
      if (result.ok) {
        setStatus("success");
        setMessage("결제가 완료됐어요. 실제 노출 적용은 준비 중이에요.");
      } else {
        setStatus("error");
        setMessage(result.reason ?? "결제 검증에 실패했어요.");
      }
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "결제 중 오류가 발생했어요.");
    }
  }

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

  if (status === "success") {
    return (
      <div className="mt-6 rounded-2xl border bg-card p-8 text-center">
        <p className="text-lg font-bold text-primary">결제 완료</p>
        <p className="mt-2 text-sm break-keep text-muted-foreground">{message}</p>
        <Link href="/mypage/church" className={cn(buttonVariants(), "mt-5")}>
          교회 공고 관리로
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6 rounded-2xl border bg-card p-5 sm:p-6">
      {/* 대상 공고 */}
      <section>
        <h2 className="mb-2.5 text-sm font-bold">대상 공고</h2>
        <NativeSelect
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
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

      {/* 노출 상품 */}
      <section>
        <h2 className="mb-2.5 text-sm font-bold">노출 상품</h2>
        <div className="space-y-2.5">
          {(Object.keys(EXPOSURE_PRODUCTS) as ExposureProduct[]).map((key) => {
            const p = EXPOSURE_PRODUCTS[key];
            const on = tier === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTier(key)}
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
                      주 {(p.weekly / 10000).toLocaleString("ko-KR")}만원
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs break-keep text-muted-foreground">
                    {p.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 노출 기간 */}
      <section>
        <h2 className="mb-2.5 text-sm font-bold">노출 기간</h2>
        <div className="flex gap-2">
          {EXPOSURE_WEEKS.map((w) => {
            const on = weeks === w;
            return (
              <button
                key={w}
                type="button"
                onClick={() => setWeeks(w)}
                aria-pressed={on}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2.5 text-sm font-bold transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary",
                )}
              >
                {w}주
                {w === 4 && (
                  <span className="block text-[11px] font-medium opacity-80">묶음 할인</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 결제 요약 */}
      <section>
        <h2 className="mb-2.5 text-sm font-bold">결제 요약</h2>
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {product.label} · {weeks}주
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

      {/* 동의 */}
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

      {status === "error" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm break-keep text-destructive">
          {message}
        </p>
      )}

      <div>
        <Button
          type="button"
          size="lg"
          onClick={pay}
          disabled={!agreed || status === "processing"}
          className="h-13 w-full text-base"
        >
          {status === "processing" ? "결제 진행 중…" : `${won(amount)} 결제하기`}
        </Button>
        <p className="mt-2.5 text-center text-[11px] leading-relaxed text-muted-foreground">
          테스트 모드 — 실제 청구는 없어요. 결제 성공 시 실제 노출 적용은 준비 중이에요.
        </p>
      </div>
    </div>
  );
}
