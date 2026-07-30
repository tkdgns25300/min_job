import Link from "next/link";
import { hasChurchAccess, loginPathWithNext } from "@/lib/auth";
import { getCurrentUser } from "@/lib/queries/users";
import type { CurrentUser } from "@/types/domain";

// 헤더 우측 계정 영역 — 세션 쿠키는 httpOnly(cookie-options.ts)라 클라이언트가 못 읽어 서버에서 읽는다.
// 쿠키 의존이라 dynamic → header.tsx가 <Suspense>로 격리한다.
// ⚠️ 트레이드오프: 이 영역 때문에 공개 페이지가 ○ Static → ◐ PPR이 된다. 셸은 계속 prerender돼
//    엣지에서 스트리밍되지만 문서 응답은 no-store라 요청마다 함수가 돈다(비로그인은 Auth 왕복 없음).
//    "헤더에 로그인 상태를 보여준다"를 지키는 대가로 받아들인 비용.
// 아바타는 마이페이지 직행 링크(로그아웃·회원탈퇴는 /mypage 안).
export async function HeaderAccount() {
  const user = await getCurrentUser();

  return (
    <div className="ml-auto flex items-center gap-3 sm:gap-4">
      <Link
        href={postJobHref(user)}
        className="rounded-full border border-white/25 px-3 py-1.5 text-sm font-semibold text-white/85 transition-colors hover:border-white/45 hover:text-white"
      >
        교회 공고 등록
      </Link>
      {user ? (
        <Link
          href="/mypage"
          aria-label="마이페이지"
          className="flex size-9 items-center justify-center rounded-full bg-gold text-sm font-bold text-brand-900"
        >
          {(user.name ?? user.email).trim().charAt(0)}
        </Link>
      ) : (
        <Link href="/login" className="text-sm text-white/70 transition-colors hover:text-white">
          로그인
        </Link>
      )}
    </div>
  );
}

// 스트리밍 대기 자리 — 실제와 같은 글자를 투명하게 깔아 폭·높이를 맞춘다(레이아웃 흔들림 방지).
// 대다수 방문자는 비로그인이므로 그 모양(등록 pill + "로그인" 링크)을 기준으로 잡았다.
// 딥그린 헤더에선 animate-pulse 스켈레톤이 도리어 튀어서 투명 텍스트 방식을 썼다.
export function HeaderAccountFallback() {
  return (
    <div className="ml-auto flex items-center gap-3 sm:gap-4" aria-hidden>
      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-transparent">
        교회 공고 등록
      </span>
      <span className="text-sm text-transparent">로그인</span>
    </div>
  );
}

// "교회 공고 등록"(파는쪽 상시 진입) 목적지 — 로그인·인증 상태로 분기.
// 비로그인은 로그인 후 교회 인증으로 이어지게 ?next=를 실어 보낸다(그냥 /login이면 /mypage로 튄다).
function postJobHref(user: CurrentUser | null): string {
  if (!user) return loginPathWithNext("/mypage/verify");
  return hasChurchAccess(user) ? "/mypage/church" : "/mypage/verify";
}
