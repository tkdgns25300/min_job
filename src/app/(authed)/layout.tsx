import type { Metadata } from "next";
import { setBookmark } from "@/app/(authed)/mypage/actions";
import { BookmarkProvider } from "@/components/job/bookmark-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

// 로그인 영역 전체 색인 제외 — 하위 페이지가 상속(개별 noindex 불필요).
// 게이트가 리다이렉트하기 전의 껍데기가 색인되는 것을 막는다.
export const metadata: Metadata = { robots: { index: false } };

// 인증 게이트는 각 페이지가 requireUser()로 검사한다(최종 방어선 · 인자 없음 — 복귀 경로는 proxy 헤더).
// ⚠️ 새 페이지를 추가하면 ① 그 페이지에서 requireUser() 호출 ② 경로가 `src/proxy.ts`의
//    PROTECTED_PREFIXES에 걸리는지 확인(빠지면 진짜 307 대신 200+스켈레톤으로 나간다).
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 저장한 공고 컨텍스트 — 헤더의 세션 hole이 심고(`BookmarkSeed`), 저장 버튼들이 읽는다.
          클라이언트 컴포넌트지만 서버 데이터가 없어 프리렌더에 영향이 없다. 액션은 여기서 넘긴다 —
          `components/`가 `app/`을 import하지 않게(`bookmark-provider.tsx` 머리말). */}
      <BookmarkProvider setBookmark={setBookmark}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </BookmarkProvider>
    </>
  );
}
