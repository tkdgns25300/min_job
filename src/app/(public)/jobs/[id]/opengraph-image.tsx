import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getJobDetail } from "@/lib/queries/jobs";
import { jobShareCard, type ShareCell } from "@/lib/seo";
import { OG_COLORS } from "@/constants/site";

// 공고별 공유 카드(카톡·슬랙 링크 미리보기) — **글이 아니라 구조**를 그린다(재설계 2026-09-06).
// 미리보기는 이미지 아래에 제목·설명을 따로 붙이므로 이미지에는 제목을 넣지 않는다(그전엔 제목이 세 번 나왔다).
// 위: 교회 · 교단(작게) / 자리 한 줄(크게) / 아래: 지역 · 사례비 · 마감 칸 셋 — 값이 없으면 흐리게, 있으면 골드.
// 재료는 `jobShareCard`가 만들고 여기는 배치만 한다.
// ⚠️ 글자 크기는 **카톡 모바일 폭(약 450px = 0.375배)** 기준이다(2026-09-06) — 1200px 캔버스의 24px 라벨은 폰에서
//    9px가 된다. 라벨 32 · 값 66 · 자리 100이 폰에서 12 · 25 · 38px. 도메인 글자는 뺐다 — 카드 아래 링크가 이미 보여준다.
//
// ⚠️ 한글 글꼴은 잘라 둔 정적 TTF(굵기 700 · KS X 1001 2,350자 · `scripts/subset-og-font.py`) — satori는 woff2를
//    못 읽고, 사이트 폰트는 가변 woff2다. 굵기가 하나라 작은 글자는 색 농도로만 위계를 준다.
// ⚠️ 모듈 스코프에서 한 번만 읽는다 — 요청마다 읽으면 캐시 미스 때마다 디스크를 친다.
export const alt = "공고 공유 카드 — 자리·지역·사례비·마감";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT = "Pretendard";
const fontData = await readFile(join(process.cwd(), "src/app/fonts/pretendard-bold-subset.ttf"));

const MUTED = "rgba(255,255,255,0.55)";
// 자리 줄이 이보다 길면(직분 셋 + 부서 + 고용) 100px로는 두 줄이 칸을 덮는다 — 한 단계 내린다
const ROLE_LONG_CHARS = 14;
const ROLE_FONT = { normal: 100, long: 80 } as const;
const CELL_ACCENT: Record<string, string> = { 사례비: OG_COLORS.gold, 마감: OG_COLORS.gold };

function Cell({ cell, first }: { cell: ShareCell; first: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        paddingLeft: first ? 0 : 36,
        borderLeft: first ? "none" : "2px solid rgba(255,255,255,0.18)",
      }}
    >
      <div style={{ display: "flex", fontSize: 32, color: MUTED, marginBottom: 10 }}>
        {cell.label}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 66,
          letterSpacing: -1,
          lineClamp: 1,
          color: cell.muted ? MUTED : (CELL_ACCENT[cell.label] ?? "#ffffff"),
        }}
      >
        {cell.value}
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getJobDetail(id);
  if (!detail) notFound();

  const card = jobShareCard(detail);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "52px 64px 44px",
        background: OG_COLORS.brand900,
        color: "#ffffff",
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{ display: "flex", fontSize: 36, color: "rgba(255,255,255,0.72)", lineClamp: 1 }}
        >
          {card.context}
        </div>
        {/* 자리 줄 — 직분이 여럿이면 길어진다. 긴 줄은 한 단계 작게, 그래도 두 줄까지만 두고 그 뒤는 자른다 */}
        <div
          style={{
            display: "flex",
            fontSize: card.role.length > ROLE_LONG_CHARS ? ROLE_FONT.long : ROLE_FONT.normal,
            lineHeight: 1.12,
            letterSpacing: -3,
            lineClamp: 2,
          }}
        >
          {card.role}
        </div>
      </div>

      <div style={{ display: "flex" }}>
        {card.cells.map((cell, i) => (
          <Cell key={cell.label} cell={cell} first={i === 0} />
        ))}
      </div>

      <div style={{ display: "flex", fontSize: 52, letterSpacing: -1 }}>
        <span style={{ color: OG_COLORS.gold }}>Min</span>
        <span>Job</span>
      </div>
    </div>,
    { ...size, fonts: [{ name: FONT, data: fontData, style: "normal", weight: 700 }] },
  );
}
