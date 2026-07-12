import { MinisterActivity } from "./minister-activity";
import type { CurrentUser, JobCard } from "@/types/domain";

// 사역자 view — 모든 계정의 기본 마이페이지. 계정 헤더 + 저장한 공고 + 최근 본 공고 + 관심 교회(Phase 2).
// 교회 관리(인증 교회)는 별도 화면 /mypage/church, 전환은 헤더 아바타 드롭다운(HeaderAccount).
// (지원현황·이력서는 사이트 내 지원 없음/인재DB Phase 3라 없음)
export function MypageView({ user, allCards }: { user: CurrentUser; allCards: JobCard[] }) {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">마이페이지</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {user.name ? `${user.name}님` : user.email}
        </p>
      </header>

      <MinisterActivity allCards={allCards} />

      {/* 관심 교회 — Phase 2 (팔로우 → 재공고 알림, 재공고 추적 차별점) */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">관심 교회</h2>
        <div className="rounded-2xl border border-dashed p-6 text-center">
          <span className="mb-2 inline-block rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
            준비 중
          </span>
          <p className="text-sm text-muted-foreground">
            관심 교회를 팔로우하면, 그 교회가 다시 청빙할 때 알려드릴게요.
          </p>
        </div>
      </section>
    </div>
  );
}
