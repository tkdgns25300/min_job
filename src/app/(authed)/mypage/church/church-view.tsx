import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { MyJobRow } from "@/components/job/my-job-row";
import { cn } from "@/lib/utils";
import { DENOMINATIONS, REGIONS } from "@/constants/domain";
import type { CurrentUser } from "@/types/domain";
import type { ChurchDashboard, MyJob } from "@/lib/queries/users";

// ============ 교회 인증 완료: 관리 view (스탯 바 + 리스트 + 사이드바 하이브리드) ============

function StatBar({ managed }: { managed: MyJob[] }) {
  const stats = [
    { label: "게재 중", value: managed.filter((j) => j.status === "OPEN").length },
    { label: "검수 중", value: managed.filter((j) => j.status === "PENDING").length },
    { label: "마감", value: managed.filter((j) => j.status === "CLOSED").length },
  ];
  return (
    <dl className="flex overflow-hidden rounded-xl border bg-card">
      {stats.map((s, i) => (
        <div key={s.label} className={cn("flex-1 px-5 py-4", i > 0 && "border-l")}>
          <dd className={cn("text-2xl font-bold tabular-nums", s.value === 0 && "text-muted-foreground")}>
            {s.value}
          </dd>
          <dt className="mt-0.5 text-xs text-muted-foreground">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function ChurchDashboardView({ user, dashboard }: { user: CurrentUser; dashboard: ChurchDashboard }) {
  const { church, managed, claimableCount } = dashboard;
  const churchLine = church
    ? [church.name, DENOMINATIONS[church.denomination], REGIONS[church.region]].join(" · ")
    : (user.churchName ?? "");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">교회 공고 관리</h1>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            인증 교회
          </Badge>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{churchLine}</p>
      </header>

      <StatBar managed={managed} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        {/* 좌: 공고 목록 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">내 교회 공고</h2>
          {managed.length > 0 ? (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
              {managed.map((job) => (
                <MyJobRow key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-dashed p-8 text-center">
              <p className="text-sm leading-relaxed text-muted-foreground">
                아직 등록한 공고가 없어요. 첫 공고를 등록해 보세요 — 등록은 무료예요.
              </p>
              <Link href="/jobs/new" className={cn(buttonVariants({ size: "sm" }))}>
                공고 등록하기
              </Link>
            </div>
          )}
        </section>

        {/* 우: 사이드바 (빠른 액션 · 노출 문의 · 클레임) */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <Link href="/jobs/new" className={cn(buttonVariants(), "w-full")}>
              새 공고 등록
            </Link>
            <p className="mt-2.5 text-center text-xs text-muted-foreground">인증 교회는 무료로 등록해요</p>
          </div>

          <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <h3 className="font-bold">공고를 더 눈에 띄게</h3>
            <p className="mt-1.5 text-sm text-primary-foreground/75">
              프리미엄·대표광고로 더 많은 교역자에게 노출하세요.
            </p>
            <Link href="/pricing" className={cn(buttonVariants({ variant: "secondary" }), "mt-3.5 w-full")}>
              노출 문의하기
            </Link>
          </div>

          {claimableCount > 0 && (
            <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/[0.04] p-5">
              <h3 className="text-sm font-bold">운영자가 정리한 공고 {claimableCount}건</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                우리 교회 이름으로 등록된 공고예요. 가져오면 직접 수정·관리할 수 있어요.
              </p>
              {/* mock 비활성 — Phase 1 클레임 액션(source→CHURCH, owner 연결) */}
              <button
                disabled
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 w-full")}
              >
                가져와 관리하기
              </button>
            </div>
          )}

          <p className="px-1 text-sm text-muted-foreground">교회 정보 설정 (준비 중)</p>
        </aside>
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
        <p className="mt-1.5 text-sm text-muted-foreground">{user.name ?? user.email}</p>
      </header>

      {status === null && (
        <GateCard>
          <h2 className="text-lg font-bold">교회 담당자이신가요?</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            교회 인증을 마치면 공고를 등록·관리할 수 있어요. 고유번호증(또는 사업자등록증)으로 확인하고, 등록은 무료예요.
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
            {user.churchName ? `${user.churchName} · ` : ""}제출하신 서류를 확인하고 있어요. 보통 1~2일 내 완료돼요. 승인되면 공고를 등록할 수 있어요.
          </p>
          <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none mt-4 opacity-50")}>
            공고 등록 (승인 후)
          </span>
        </GateCard>
      )}

      {status === "REJECTED" && (
        <GateCard>
          <Badge variant="secondary" className="mb-3 text-destructive">
            반려
          </Badge>
          <h2 className="text-lg font-bold">인증이 반려됐어요</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            제출하신 서류를 확인하기 어려웠어요. 고유번호증 사본을 다시 올려 주세요. 궁금한 점은 문의해 주세요.
          </p>
          <Link href="/mypage/verify" className={cn(buttonVariants(), "mt-4")}>
            다시 신청하기
          </Link>
        </GateCard>
      )}

      <Link href="/mypage" className="inline-block text-sm text-muted-foreground hover:text-foreground">
        ← 마이페이지 (저장한 공고 등)
      </Link>
    </div>
  );
}

// dashboard 있으면 교회 관리, 없으면(미인증/검수중/반려) 게이트
export function ChurchView({ user, dashboard }: { user: CurrentUser; dashboard: ChurchDashboard | null }) {
  if (dashboard) return <ChurchDashboardView user={user} dashboard={dashboard} />;
  return <ChurchGate user={user} />;
}
