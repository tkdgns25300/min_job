import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminOverview } from "@/lib/queries/jobs";

export const metadata: Metadata = { title: "운영자 홈 | 민잡 운영자" };

// 운영자 홈 — 요약 + 빠른 작업 랜딩. 요약 수치는 getAdminOverview('use cache').
// (공고 검수 제거 — 교회 인증이 유일 게이트. 인증 검수는 /admin/verify에서.)
export default async function AdminHomePage() {
  const { featuredCount, hiddenCount, weekCount, totalCount } = await getAdminOverview();

  // href = 각 수치에 대응하는 필터된 공고 관리 뷰로 딥링크.
  // 노출중(유료) = OPEN + 유료노출(featuredTier≠NONE). "이번 주 등록"은 대응 필터가 없어 전체 목록으로.
  const stats = [
    { label: "노출중(유료)", value: featuredCount, href: "/admin/jobs?tab=OPEN&featured=paid" },
    // 내려감 = 게재중인데 공개 목록에 안 뜨는 것(DATA §6-1) — 운영자가 손봐야 할 대상
    { label: "내려감", value: hiddenCount, href: "/admin/jobs?tab=HIDDEN" },
    { label: "이번 주 등록", value: weekCount, href: "/admin/jobs" },
    { label: "전체 공고", value: totalCount, href: "/admin/jobs" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">운영자 홈</h1>
        <p className="mt-1 text-sm text-muted-foreground">공고 현황 요약과 빠른 작업.</p>
      </header>

      {/* 요약 카드 — 클릭 시 대응 필터 뷰로 딥링크 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{s.value}</div>
          </Link>
        ))}
      </div>

      {/* 빠른 작업 */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold">빠른 작업</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/ingest" className={cn(buttonVariants())}>
            ＋ 공고 수집
          </Link>
          <Link href="/admin/jobs" className={cn(buttonVariants({ variant: "outline" }))}>
            공고 관리
          </Link>
        </div>
      </section>

      {/* 교회 인증 검수 — 유일한 검수 게이트(다음 단계 /admin/verify) */}
      <Link
        href="/admin/verify"
        className="mt-4 flex items-center justify-between rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <span>
          교회 인증 검수 <span className="text-xs">(다음 단계)</span>
        </span>
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
