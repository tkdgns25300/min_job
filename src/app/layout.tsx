import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
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
  // `<title>` 규칙(2026-09-06): 페이지는 **화면 이름만** 적고 접미사 " | 민잡"은 이 template이 붙인다 —
  // 그전엔 페이지마다 손으로 붙여 브랜드가 MinJob/민잡, 구분자가 —/| 로 갈렸다. 운영자 화면은 admin layout이
  // "%s | 민잡 운영자"로 덮는다. 홈은 default 그대로(브랜드 + 한 줄).
  title: { default: "민잡 — 사역자 청빙 공고", template: "%s | 민잡" },
  description:
    "흩어진 교회 사역자(담임·부목사·전도사) 청빙 공고를 한곳에 모아 교단·지역·사례비로 검색·비교하세요.",
  // 카카오톡 공유가 주 유통 경로라 링크 미리보기가 실제 유입에 영향을 준다.
  // 이미지·siteName·locale은 SITE_OPEN_GRAPH 한 곳에서 관리한다(그 파일 주석 참조).
  openGraph: { ...SITE_OPEN_GRAPH, type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        {/* 알림 토스트 그릇 — **루트에 한 번만** 심는다.
            ⚠️ 여기여야 하는 이유: 토스트를 띄우는 화면이 **세 그룹에 걸쳐 있다** —
               `admin`(판정·공고 관리 6곳) · `(authed)`(교회 정보 저장) · `(public)`(공고 상세의
               링크 복사 실패). 그룹마다 두면 그릇이 셋으로 복제되고, 그룹을 넘는 순간 통째로
               사라져 방금 띄운 것도 없어진다.
               ⚠️ 지금 그룹을 넘는 이동(로그아웃 `mypage` → `/`)은 토스트를 띄우지 않는다 —
                  근거는 **세 그룹에 걸쳐 있다**는 사실 하나다(이 주석이 한때 로그아웃을 근거로
                  적었는데 그건 아직 일어나지 않는 일이었다 · 2026-08-27 정정).
            ⚠️ **여기서 `cookies()`·`searchParams`를 읽지 않는다.** 읽으면 이 레이아웃을 쓰는
               모든 라우트가 dynamic이 되어 `/admin/jobs`가 `○ Static`에서 떨어진다
               (CLAUDE `'use cache'` 제약 #1). 토스트는 클라이언트에서만 띄운다.
            ⚠️ `{children}` **뒤에** 둔다 — `body`가 flex column이라 앞에 두면 첫 항목이 된다
               (sonner 컨테이너는 높이가 0이지만 순서는 지킨다). */}
        <Toaster />
        {/* GA4 — 측정 ID가 있을 때만 그려진다(Production). 계측 규칙은 docs/ANALYTICS.md */}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
