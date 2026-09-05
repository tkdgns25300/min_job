import Script from "next/script";
import { ADMIN_PREFIX } from "@/lib/auth";

// GA4 로더 — 루트 레이아웃에 한 번. 측정 ID(`NEXT_PUBLIC_GA_ID`)가 없으면 아무것도 그리지 않는다:
// 로컬·프리뷰 배포는 값을 두지 않아 통계가 섞이지 않는다(Vercel **Production에만** · README 환경 변수).
//
// 두 조각의 시점이 다르다:
//  · **초기화(dataLayer·gtag·config)는 HTML에 박힌 동기 스크립트** — 파싱 때 실행되어 하이드레이션 전에
//    `window.gtag`가 있다. `next/script`(afterInteractive)로 두면 effect 순서상 정적 트리의 `<TrackEvent>`가
//    먼저 돌아 이벤트가 조용히 유실된다(자식 effect가 뒤 형제의 effect보다 먼저다). 네트워크 없는 세 줄이라
//    파싱을 늦추지 않는다.
//  · **라이브러리(gtag.js)는 afterInteractive** — 하이드레이션 뒤에 받아 첫 화면을 늦추지 않는다. 그전에 쌓인
//    이벤트는 dataLayer 큐에서 순서대로 처리된다(config가 항상 먼저다).
// ⚠️ 운영자 화면(`/admin/**`)은 첫 로드에서 `config`를 건너뛴다 — 검수·관리 동선이 방문 통계에 섞이지 않게.
//    (거기서 공개 화면으로 소프트 이동하면 새로 고칠 때까지 안 잡힌다 — 운영자 한 사람의 일이라 감수한다.)
//    이벤트 쪽 방어는 `lib/analytics`의 `track`이 같은 접두사로 한다.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function GoogleAnalytics() {
  if (!GA_ID) return null;
  const init = [
    "window.dataLayer = window.dataLayer || [];",
    "function gtag(){dataLayer.push(arguments);}",
    "gtag('js', new Date());",
    `if (!location.pathname.startsWith('${ADMIN_PREFIX}')) gtag('config', '${GA_ID}');`,
  ].join("\n");
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: init }} />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
