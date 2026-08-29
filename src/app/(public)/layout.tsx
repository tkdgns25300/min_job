import { setBookmark } from "@/app/(authed)/mypage/actions";
import { BookmarkProvider } from "@/components/job/bookmark-provider";
import { Header } from "@/components/layout/header";
import { organizationJsonLd } from "@/lib/seo";
import { Footer } from "@/components/layout/footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Organization JSON-LD — 사이트 운영 주체(민잡). 공개 영역에만 둔다:
          admin·(authed)·login은 noindex라 구조화 데이터를 내보낼 이유가 없다. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />
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
