import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ChurchJobList } from "@/components/job/church-job-list";
import { cn } from "@/lib/utils";
import { churchMetaLine, formatExposurePrice } from "@/lib/format";
import { EXPOSURE_PRODUCTS } from "@/constants/domain";
import { contactMailto } from "@/constants/business";
import type { CurrentUser } from "@/types/domain";
import type { ChurchDashboard } from "@/lib/queries/users";

// ============ 교회 인증 완료: 관리 view (탭 목록 + 노출광고 전용 사이드바) ============

// 노출 광고 = 메인 BM. 사이드바 단독(sticky)으로 상시 노출. 결제는 문의 기반(우리 모델).
function ExposurePromo() {
  return (
    <aside className="lg:sticky lg:top-6">
      <div className="bg-hero rounded-2xl p-5 text-white">
        <p className="text-[11px] font-bold text-gold">MinJob 노출 광고</p>
        <h3 className="mt-1.5 font-bold">공고를 더 눈에 띄게</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/75">
          검색·목록 상단에 고정 노출해 더 많은 교역자에게 닿아요.
        </p>
        {/* 상품명·가격 모두 도메인 상수에서 읽는다 — 여기 적으면 요금 페이지·실제 청구액과 갈린다 */}
        <div className="mt-3 space-y-1.5">
          {Object.entries(EXPOSURE_PRODUCTS).map(([tier, product]) => (
            <div
              key={tier}
              className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-sm"
            >
              <span className="font-semibold">{product.label}</span>
              <span className="font-bold text-gold">주 {formatExposurePrice(product.weekly)}</span>
            </div>
          ))}
        </div>
        <Link
          href="/mypage/church/promote"
          className={cn(buttonVariants({ variant: "secondary" }), "mt-4 w-full")}
        >
          노출 신청 →
        </Link>
        <Link
          href="/pricing"
          className="mt-2.5 block text-center text-xs text-white/60 transition-colors hover:text-white/90"
        >
          노출 상품 자세히 보기 →
        </Link>
      </div>
    </aside>
  );
}

function ChurchDashboardView({
  user,
  dashboard,
}: {
  user: CurrentUser;
  dashboard: ChurchDashboard;
}) {
  const { church, managed, claimableCount } = dashboard;
  // 교단·지역은 미상일 수 있다 — 표기 규칙은 churchMetaLine이 단일 소스(아는 조각만 잇는다)
  const churchLine = church
    ? [church.name, churchMetaLine(church)].filter(Boolean).join(" · ")
    : (user.churchName ?? "");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">교회 공고 관리</h1>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              인증 교회
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{churchLine}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/mypage/church/info" className={cn(buttonVariants({ variant: "outline" }))}>
            교회 정보 관리
          </Link>
          <Link href="/jobs/new" className={cn(buttonVariants())}>
            ＋ 새 공고 등록
          </Link>
        </div>
      </header>

      {/* 운영자 공고 클레임 — 있을 때만 목록 위 배너 */}
      {claimableCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] p-4">
          <p className="text-sm break-keep">
            <span className="font-bold">운영자가 정리한 우리 교회 공고 {claimableCount}건</span>
            <span className="text-muted-foreground"> — 가져오면 직접 수정·관리할 수 있어요.</span>
          </p>
          {/* mock 비활성 — Phase 1 클레임 액션(source→CHURCH, owner 연결) */}
          <button
            disabled
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
          >
            가져와 관리하기
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-start">
        <ChurchJobList jobs={managed} />
        <ExposurePromo />
      </div>
    </div>
  );
}

// ============ 인증 게이트 (미인증 / 검수중 / 반려) ============

function GateCard({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl border bg-card p-6 sm:p-8">{children}</section>;
}

function ChurchGate({ user }: { user: CurrentUser }) {
  const status = user.churchVerificationStatus;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">교회 공고 관리</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {user.name ? `${user.name}님` : user.email}
        </p>
      </header>

      {status === null && (
        <GateCard>
          <h2 className="text-lg font-bold">교회 담당자이신가요?</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            교회 인증을 마치면 공고를 등록·관리할 수 있어요. 고유번호증(또는 사업자등록증)으로
            확인하고, 등록은 무료예요.
          </p>
          <Link href="/mypage/verify" className={cn(buttonVariants(), "mt-4")}>
            교회 인증하기
          </Link>
        </GateCard>
      )}

      {status === "PENDING" && (
        <GateCard>
          <Badge variant="outline" className="mb-3">
            검수중
          </Badge>
          <h2 className="text-lg font-bold">인증을 검토하고 있어요</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {user.churchName ? `${user.churchName} · ` : ""}제출하신 서류를 확인하고 있어요. 보통
            1~2일 내 완료돼요. 승인되면 공고를 등록할 수 있어요.
          </p>
          <span
            className={cn(
              buttonVariants({ variant: "outline" }),
              "pointer-events-none mt-4 opacity-50",
            )}
          >
            공고 등록 (승인 후)
          </span>
        </GateCard>
      )}

      {/* 사람은 승인됐는데 교회가 아직 검수 중인 상태 — `hasChurchAccess`가 양쪽을 보므로 여기로 온다.
          세 분기(null·PENDING·REJECTED) 어디에도 안 걸려 **빈 화면**이 되던 자리다.
          승인이 두 테이블을 함께 바꾸다 한쪽만 성공해도 이 상태가 된다(SPEC 교회 인증). */}
      {status === "APPROVED" && (
        <GateCard>
          <Badge variant="outline" className="mb-3">
            교회 검수중
          </Badge>
          <h2 className="text-lg font-bold">교회 확인이 끝나면 열려요</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {user.churchName ? `${user.churchName} · ` : ""}담당자 인증은 완료됐고, 교회 정보를
            확인하고 있어요.
          </p>
          {/* 이 카드에는 진행할 곳이 없다 — 문의 수단까지 빼면 사용자가 갇힌다 */}
          <a
            href={contactMailto("교회 검수 진행 문의")}
            className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
          >
            문의하기
          </a>
        </GateCard>
      )}

      {status === "REJECTED" && (
        <GateCard>
          <Badge variant="secondary" className="mb-3 text-destructive">
            반려
          </Badge>
          <h2 className="text-lg font-bold">인증이 반려됐어요</h2>
          {/* 사유는 운영자가 적은 것을 그대로 보여준다 — 여기서 사유를 특정하면 실제 반려 근거와
              어긋난다(서류 문제라고 안내했는데 연락처 문제인 식). 아래 폴백은 타입상 안전망일 뿐
              도달하지 않는다 — REJECTED면 사유가 반드시 있다(DATA §3 CHECK) */}
          <p className="mt-2 max-w-md text-sm leading-relaxed break-keep text-muted-foreground">
            {user.churchRejectionReason ??
              "제출하신 내용을 확인하기 어려웠어요. 다시 신청해 주세요."}
          </p>
          <Link href="/mypage/verify" className={cn(buttonVariants(), "mt-4")}>
            다시 신청하기
          </Link>
        </GateCard>
      )}

      <Link
        href="/mypage"
        className="inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← 마이페이지 (저장한 공고 등)
      </Link>
    </div>
  );
}

// dashboard 있으면 교회 관리, 없으면(미인증/검수중/반려) 게이트
export function ChurchView({
  user,
  dashboard,
}: {
  user: CurrentUser;
  dashboard: ChurchDashboard | null;
}) {
  if (dashboard) return <ChurchDashboardView user={user} dashboard={dashboard} />;
  return <ChurchGate user={user} />;
}
