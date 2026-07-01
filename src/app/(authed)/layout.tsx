import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

// 인증 게이트(proxy)는 Phase 1에서 추가. 지금은 공개 셸과 동일 구조의 뼈대.
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
