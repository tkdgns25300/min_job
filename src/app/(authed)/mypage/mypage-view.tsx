import Link from "next/link";
import { MinisterActivity } from "./minister-activity";
import { AccountActions } from "./account-actions";
import { hasChurchAccess } from "@/lib/auth";
import type { CurrentUser, JobCard } from "@/types/domain";

// 사역자 view — 모든 계정의 기본 마이페이지. 계정 헤더 + 저장한 공고 + 최근 본 공고 + 관심 교회(Phase 2).
// 교회 관리(인증 교회)는 별도 화면 /mypage/church, 전환은 헤더 아바타 드롭다운(HeaderAccount).
// (지원현황·이력서는 사이트 내 지원 없음/인재DB Phase 3라 없음)
export function MypageView({ user, allCards }: { user: CurrentUser; allCards: JobCard[] }) {
  const canChurch = hasChurchAccess(user);
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">마이페이지</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {user.name ? `${user.name}님` : user.email}
        </p>
      </header>

      <MinisterActivity allCards={allCards} />

      {/* 관심 교회 — Phase 2 (팔로우 → 새 공고 알림) */}
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

      {/* 교회 공고 — 맨 하단. 인증 여부에 따라 관리 or 인증 유도(공급 확보 진입점) */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">교회 공고</h2>
        {canChurch ? (
          <Link
            href="/mypage/church"
            className="block rounded-2xl border p-5 transition-colors hover:border-primary"
          >
            <p className="font-bold">교회 공고 관리 →</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.churchName ?? "우리 교회"} 공고를 등록·관리하세요.
            </p>
          </Link>
        ) : (
          <Link
            href="/mypage/verify"
            className="bg-hero block rounded-2xl p-6 text-white transition-opacity hover:opacity-95"
          >
            <span className="text-[11px] font-bold text-gold">교회 담당자</span>
            <p className="mt-1.5 text-base font-bold break-keep">우리 교회 공고, 직접 올려보세요</p>
            <p className="mt-1.5 text-sm leading-relaxed break-keep text-white/75">
              교회 인증(고유번호증·사업자등록증)을 마치면 공고를 직접 등록·관리할 수 있어요.
            </p>
            <span className="mt-4 inline-block rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-primary">
              교회 인증하기 →
            </span>
          </Link>
        )}
      </section>

      {/* 계정 — 로그아웃 · 회원탈퇴 (헤더 아바타는 마이페이지 직행이라 여기로 이동) */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">계정</h2>
        <AccountActions />
      </section>
    </div>
  );
}
