import Link from "next/link";
import { MinisterActivity } from "./minister-activity";
import { AccountActions } from "./account-actions";
import { hasChurchAccess } from "@/lib/auth";
import type { CurrentUser, JobCard } from "@/types/domain";

// 사역자 view — 모든 계정의 기본 마이페이지. 저장한 공고 + 최근 본 공고 + 교회 진입점 + 계정.
// 교회 관리(인증 교회)는 별도 화면 /mypage/church.
//
// ⚠️ **같은 페이지인데 순서가 사람에 따라 다르다**(2026-08-28 재구성).
//    · 인증 교회 담당자 · 인증 신청 중 → 교회 카드가 **맨 위**. 이 사람이 여기 오는 목적이 교회 관리인데,
//      한때 그 카드가 스크롤 세 번 아래("관심 교회 — 준비 중" 상자 다음)에 있었다.
//    · 그 밖(대다수 구직자) → 저장·최근이 먼저, 인증 유도는 그 아래. 구직자 화면의 첫 장면이
//      "교회 담당자세요?"가 되면 방향이 어긋난다.
// ⛔ **관심 교회(팔로우) 섹션은 뺐다.** Phase 2 기능이고 알림 채널(이메일)조차 없는데 "준비 중" 상자가
//    자리를 먹고 있었다. 안 만든 기능의 자리는 두지 않는다 — 대시보드의 `⋯` 메뉴·수정 화면의
//    `disabled` 삭제 버튼을 걷어낸 것과 같은 결.
// ⚠️ 헤더 아바타는 계속 여기(`/mypage`)로 온다 — 인증 교회라고 `/mypage/church`로 보내면 로그아웃이
//    그 화면 맨 아래 작은 링크 하나만 남는다. 아바타는 **계정** 진입점이고, "교회 공고 등록" pill이
//    **작업** 바로가기다(라벨도 목적도 다르다).
// (지원현황·이력서는 사이트 내 지원 없음/인재DB Phase 3라 없음)
export function MypageView({ user, saved }: { user: CurrentUser; saved: JobCard[] }) {
  // 신청만 했어도 "교회 쪽 사람"이다 — 검수중·반려 상태를 확인하러 온다
  const churchFirst = hasChurchAccess(user) || user.churchVerificationStatus !== null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">마이페이지</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {user.name ? `${user.name}님` : user.email}
        </p>
      </header>

      {churchFirst && <ChurchEntry user={user} />}

      <MinisterActivity saved={saved} />

      {!churchFirst && <ChurchEntry user={user} />}

      {/* 계정 — 로그아웃 · 회원탈퇴 (헤더 아바타는 마이페이지 직행이라 여기로 이동) */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">계정</h2>
        <AccountActions />
      </section>
    </div>
  );
}

/**
 * 교회 쪽 진입점 — 인증 여부에 따라 관리 / 진행 상태 / 인증 유도(공급 확보 진입점).
 * 제목(h2)을 두지 않는다 — 카드가 스스로 말하고, 맨 위에 올 때는 페이지 제목 바로 아래 **첫 행동**으로
 * 읽혀야 한다.
 */
function ChurchEntry({ user }: { user: CurrentUser }) {
  const church = user.churchName ?? "우리 교회";

  // 인증됐거나 신청 중이면 **같은 카드, 다른 말**로 /mypage/church에 보낸다.
  // 신청만 한 상태(검수중·교회 미검증·반려)에서 "인증하세요"라고 하면 이미 인증을 마친 사람에게 거짓
  // 안내가 된다 — 상태별 문구는 그 화면의 게이트가 정본이라 여기서 되풀이하지 않는다.
  const card = hasChurchAccess(user)
    ? { title: "교회 공고 관리 →", desc: `${church} 공고를 등록·관리하세요.` }
    : user.churchVerificationStatus !== null
      ? { title: "교회 인증 진행 상태 →", desc: `${church} 인증이 어디까지 왔는지 확인하세요.` }
      : null;

  if (card) {
    return (
      <Link
        href="/mypage/church"
        className="block rounded-2xl border border-primary/25 bg-primary/5 p-5 transition-colors hover:border-primary"
      >
        <p className="font-bold">{card.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{card.desc}</p>
      </Link>
    );
  }

  return (
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
  );
}
