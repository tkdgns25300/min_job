import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { contactMailto } from "@/constants/business";
import { EXPOSURE_PRODUCTS } from "@/constants/domain";
import type { PromotionResult } from "./actions";

// 결제 완료 처리의 결과 화면 — PC(결제 화면 안)와 모바일 복귀(`?paymentId=`) 두 경로가 **같은 화면**을 그린다.
// 세 갈래: 적용됨 / 청구됐는데 적용 못 함(문의) / 청구 없음(다시 신청).
// 해요체 — 교회 화면의 인라인 문구 규칙(CLAUDE "알림은 성공=토스트 / 실패=인라인").

export function PromoteOutcome({
  result,
  paymentId,
}: {
  result: PromotionResult;
  paymentId: string;
}) {
  if (result.ok) {
    const product = EXPOSURE_PRODUCTS[result.order.tier];
    return (
      <div className="mt-6 rounded-2xl border bg-card p-8 text-center">
        <p className="text-lg font-bold text-primary">노출이 적용됐어요</p>
        <p className="mt-2 text-sm break-keep text-muted-foreground">
          <b className="text-foreground">{product.label}</b> · {result.order.startsAt} ~{" "}
          {result.endsAt}
          {" · "}
          {result.order.weeks}주
        </p>
        <p className="mt-1 text-xs break-keep text-muted-foreground">
          시작일이 오늘 이후면 그날부터 보여요. 공개 목록은 바로 갱신됐어요.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          결제번호 <span className="font-mono break-all">{paymentId}</span>
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {/* 스페셜만 홈에 선다 — 나머지는 목록 상단·비슷한 공고 첫 칸이라 목록으로 보낸다 */}
          <Link href={product.slots.home ? "/" : "/jobs"} className={cn(buttonVariants())}>
            {product.slots.home ? "홈에서 보기" : "목록에서 보기"}
          </Link>
          <Link href="/mypage/church" className={cn(buttonVariants({ variant: "outline" }))}>
            교회 공고 관리로
          </Link>
        </div>
      </div>
    );
  }

  if (result.charged) {
    return (
      <div
        className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-center"
        role="alert"
      >
        <p className="text-lg font-bold text-destructive">결제 확인이 필요해요</p>
        <p className="mt-2 text-sm break-keep text-muted-foreground">
          <b>카드 청구는 완료됐을 수 있어요.</b> {result.message}
          <br />
          다시 결제하지 말고 아래 번호로 문의해 주세요. 확인 후 적용하거나 환불해 드려요.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          결제번호 <span className="font-mono break-all">{paymentId}</span>
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <a
            href={contactMailto(`노출 결제 확인 요청 (${paymentId})`)}
            className={cn(buttonVariants())}
          >
            결제 문의하기
          </a>
          <Link href="/mypage/church" className={cn(buttonVariants({ variant: "outline" }))}>
            교회 공고 관리로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border bg-card p-8 text-center" role="alert">
      <p className="text-lg font-bold">노출이 적용되지 않았어요</p>
      <p className="mt-2 text-sm break-keep text-muted-foreground">{result.message}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link href="/mypage/church/promote" className={cn(buttonVariants())}>
          다시 신청하기
        </Link>
        <Link href="/mypage/church" className={cn(buttonVariants({ variant: "outline" }))}>
          교회 공고 관리로
        </Link>
      </div>
    </div>
  );
}
