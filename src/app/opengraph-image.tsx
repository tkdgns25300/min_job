import { ImageResponse } from "next/og";
import { SITE_DOMAIN } from "@/constants/site";

// 사이트 공통 OG 이미지 — 링크 공유(특히 카카오톡) 미리보기 썸네일. 전 페이지가 이 한 장을 쓴다.
//
// ⚠️ 한글을 쓰지 않는다: ImageResponse(satori)는 ttf·otf·woff만 지원하는데 우리 폰트는
//    PretendardVariable.**woff2**라 못 읽고, 번들 500KB 제한 때문에 한글 폰트를 넣기도 어렵다.
//    다행히 로고 자체가 영문(MinJob)이라 브랜드 카드로는 충분하다.
//    공고 제목이 박힌 **공고별 이미지**를 원하면 한글 정적 폰트(ttf/otf)가 먼저 필요하다(ROADMAP 1-5).
//
// ℹ️ 파일 규약의 `alt` export는 두지 않는다 — root layout이 `openGraph.images`를 직접 지정해서
//    Next의 자동 주입 경로를 우회하므로 여기 적어도 태그에 안 나온다. alt는 `SITE_OPEN_GRAPH`에 있다.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// globals.css의 브랜드 토큰과 동일한 값(satori는 CSS 변수를 못 읽어 리터럴로 둔다).
// ⚠️ 브랜드 색을 바꾸면 globals.css와 **여기 둘 다** 고쳐야 한다.
const BRAND_900 = "#15332a";
const GOLD = "#d3ad63";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        background: BRAND_900,
        color: "#ffffff",
      }}
    >
      {/* ⚠️ fontWeight는 지정해도 안 먹는다 — 폰트를 안 넘기면 satori 기본 폰트의 단일 두께만 쓴다.
            굵기가 필요하면 정적 ttf/otf를 fonts 옵션으로 넘겨야 한다(위 주석의 한글 폰트와 같은 조건). */}
      <div style={{ display: "flex", fontSize: 132, letterSpacing: -4 }}>
        <span style={{ color: GOLD }}>Min</span>
        <span>Job</span>
      </div>
      <div style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.72)" }}>
        {SITE_DOMAIN}
      </div>
      <div style={{ display: "flex", width: 132, height: 5, background: GOLD, marginTop: 8 }} />
    </div>,
    size,
  );
}
