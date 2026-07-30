import type { Metadata } from "next";
import localFont from "next/font/local";
import { SITE_OPEN_GRAPH, SITE_URL } from "@/constants/site";
import "./globals.css";

// Pretendard 변수 폰트 self-host (next/font/local — preload·CLS 방지)
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  variable: "--font-pretendard",
  weight: "45 920",
});

export const metadata: Metadata = {
  // metadataBase = 상대 경로 메타데이터(canonical·Open Graph)를 절대 URL로 바꾸는 기준.
  // 없으면 OG URL이 비거나 프리뷰 도메인이 새어 들어간다.
  metadataBase: new URL(SITE_URL),
  title: "MinJob — 사역자 청빙 공고",
  description:
    "흩어진 교회 사역자(담임·부목사·전도사) 청빙 공고를 한곳에 모아 교단·지역·사례비로 검색·비교하세요.",
  // 카카오톡 공유가 주 유통 경로라 링크 미리보기가 실제 유입에 영향을 준다.
  // ⚠️ OG 이미지는 아직 없다 — 미리보기에 그림이 안 뜬다(ROADMAP 1-5).
  openGraph: { ...SITE_OPEN_GRAPH, type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
