import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Pretendard 변수 폰트 self-host (next/font/local — preload·CLS 방지)
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  variable: "--font-pretendard",
  weight: "45 920",
});

export const metadata: Metadata = {
  title: "MinJob — 부교역자 청빙 공고",
  description:
    "흩어진 부교역자(부목사·전도사) 청빙 공고를 한곳에 모아 교단·지역·사례비로 검색·비교하세요.",
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
