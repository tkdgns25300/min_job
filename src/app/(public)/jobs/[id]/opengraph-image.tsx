import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getJobDetail } from "@/lib/queries/jobs";
import { jobShareLines } from "@/lib/seo";
import { OG_COLORS, SITE_DOMAIN } from "@/constants/site";

// 공고별 공유 카드 — 카카오톡·SNS에 링크를 붙였을 때 뜨는 1200×630 썸네일(운영자 요청 2026-09-05).
// 그전엔 전 페이지가 로고 한 장(`app/opengraph-image.tsx`)이었다. 세 줄의 내용은 `jobShareLines`가
// 정하고 `og:description`도 같은 줄을 쓴다 — 그림과 글이 다른 말을 하지 않게.
//
// **한글 글꼴은 잘라 둔 정적 TTF를 디스크에서 읽는다**(`scripts/subset-og-font.py`). satori는 woff2를 못 읽고
// 한글 전체는 2MB라, KS X 1001 2,350자만 담은 450KB짜리를 굵기 하나(700)로 둔다. 위계는 크기·색으로.
// 모듈 스코프에서 한 번 읽는다(요청마다 읽지 않는다 · Next 문서의 "local assets" 예제와 같은 모양).
// 데이터는 `getJobDetail`('use cache' · `job-<id>` 태그)이라 이 라우트도 그 캐시 위에서 돈다.
// alt는 정적 export만 된다(공고별 문장은 `generateImageMetadata`가 필요) — 카드의 뜻만 적는다
export const alt = "공고 요약 카드 — 교회·자리·사례비·마감";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT = "Pretendard";

const fontData = await readFile(join(process.cwd(), "src/app/fonts/pretendard-bold-subset.ttf"));

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getJobDetail(id);
  if (!detail) notFound();

  const { context, headline, facts } = jobShareLines(detail);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: OG_COLORS.brand900,
        color: "#ffffff",
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* satori의 lineClamp — 긴 교회명·제목이 카드를 밀어내지 않게 줄 수를 고정한다 */}
        <div
          style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.72)", lineClamp: 1 }}
        >
          {context}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            lineHeight: 1.18,
            letterSpacing: -2,
            lineClamp: 2,
          }}
        >
          {headline}
        </div>
        <div style={{ display: "flex", fontSize: 38, color: OG_COLORS.gold, lineClamp: 1 }}>
          {facts}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 44, letterSpacing: -1 }}>
          <span style={{ color: OG_COLORS.gold }}>Min</span>
          <span>Job</span>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.6)" }}>
          {SITE_DOMAIN}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: FONT, data: fontData, style: "normal", weight: 700 }],
    },
  );
}
