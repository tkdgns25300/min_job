import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { CHURCH_STATUSES, CHURCH_VERIFICATION_STATUSES } from "@/constants/domain";
import { requireOperator } from "@/lib/auth-guard";
import { formatKstDate } from "@/lib/format";
import { getVerification } from "@/lib/queries/verifications";
import type { ChurchVerification } from "@/types/domain";
import { VERIFICATION_STATUS_VARIANT } from "../verification-row";
import { DecisionPanel } from "./decision-panel";
import { DocView } from "./doc-view";

export const metadata: Metadata = { title: "교회 인증 판정" };

// 교회 인증 판정 — 증빙 서류를 크게 놓고 옆에서 값을 맞춰 본다.
//
// **2열인 이유는 하나다**: 고유번호증은 A4 한 장이라 좁은 폭에서는 10자리 번호가 읽히지 않는다.
// 시트(448px)에 넣어 봤다가 페이지로 옮겼다 — 수집 검수가 같은 이유로 2열이 됐고 그 실측이
// `doc-view.tsx` 머리말에 있다.
//
// **dynamic** — 운영자 전용 + 담당자 PII라 `'use cache'` 금지. 셸에 정적으로 그릴 것이 없고
// (서류 signed URL이 30분 만료) 전체를 `<Suspense>`로 감싼다.
export default function VerifyDecisionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
      {/* `params`도 uncached다 — 페이지 본문에서 await하면 셸까지 프리렌더가 막힌다(cacheComponents) */}
      <Suspense fallback={<DetailSkeleton />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 운영자 전용 · PII — proxy가 1차로 막지만 여기서도 다시 확인한다(fail-closed)
  await requireOperator();
  const verification = await getVerification(id);
  if (verification === null) notFound();

  // ⚠️ **`doc`을 떼어 낸 나머지만 판정 패널에 넘긴다.** 패널은 client 컴포넌트이고 서류를 쓰지
  //    않는데, 통째로 넘기면 30분 signed URL이 `DocView` 몫과 **두 번** 직렬화된다.
  const { doc, ...application } = verification;

  return (
    <>
      <Header verification={verification} />
      {/* 서류가 넓어야 읽힌다 — 오른쪽은 값을 훑는 열이라 고정 폭으로 둔다 */}
      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-2 text-xs font-bold text-muted-foreground">증빙 서류</h2>
          <DocView doc={doc} />
        </section>
        {/* 판정 열은 스크롤을 따라온다 — 서류를 내려 보며 값과 버튼을 계속 쓴다 */}
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
          {verification.status === "PENDING" ? (
            <DecisionPanel verification={application} />
          ) : (
            <Decided verification={verification} />
          )}
        </div>
      </div>
    </>
  );
}

function Header({ verification }: { verification: ChurchVerification }) {
  const { church, status } = verification;
  return (
    <header>
      <Link
        href="/admin/verify"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 인증 큐
      </Link>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{church.name}</h1>
        {/* 아직 검증 안 된 교회 — "신규"라고 쓰지 않는다: 반려 뒤 재신청도 같은 행을 다시 쓴다 */}
        {church.verificationStatus !== "APPROVED" && (
          <Badge variant="secondary" className="font-medium">
            {CHURCH_STATUSES.PENDING}
          </Badge>
        )}
        <Badge variant={VERIFICATION_STATUS_VARIANT[status]}>
          {CHURCH_VERIFICATION_STATUSES[status]}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          제출일 {formatKstDate(verification.submittedAt)}
        </span>
      </div>
    </header>
  );
}

/** 이미 판정된 신청 — 결과만 보여준다. 되돌리기는 만들지 않았다(actions.ts 머리말) */
function Decided({ verification }: { verification: ChurchVerification }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <h2 className="text-sm font-bold">
        {CHURCH_VERIFICATION_STATUSES[verification.status]} 처리된 신청입니다
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        검수일 {formatKstDate(verification.reviewedAt) ?? "—"}
      </p>
      {verification.rejectionReason && (
        <p className="mt-3 rounded-lg bg-destructive/5 px-3 py-2 text-sm leading-relaxed break-keep text-destructive">
          {verification.rejectionReason}
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed break-keep text-muted-foreground">
        신청자가 다시 신청하면 이 자리에 새 신청으로 올라옵니다.
      </p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="h-7 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
        <div className="h-[70dvh] animate-pulse rounded-xl bg-muted" />
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
