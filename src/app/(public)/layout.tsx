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
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
