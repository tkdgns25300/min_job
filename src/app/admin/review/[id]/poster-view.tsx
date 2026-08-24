"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReviewPoster } from "@/lib/queries/review";

// 포스터 보기 — 검수의 대부분이 그림이라 이 화면의 절반은 사실 그림 보는 도구다.
//
// 확대가 필요한 이유: 게시판 포스터는 A4 한 장을 통째로 그려 넣은 것이라 열 폭에 맞추면
// **연락처·사례비 숫자가 읽히지 않는다**(실측). 새 탭으로 여는 것만으로는 값과 대조할 수 없다 —
// 그림과 값이 같은 화면에 있어야 검수가 된다.
//
// ⚠️ **이미지만 오는 게 아니다** — 크롤러는 PDF도 같은 배열에 담는다(`ReviewPoster.kind`).
//    PDF를 `<img>`로 그리면 깨진 그림 아이콘이 나온다(실측 2026-08-23 · PUTS 건).

/** 배율 단계 — 1은 열 폭에 맞춤. 그 위는 가로 스크롤이 생긴다 */
const ZOOMS = [1, 2, 3] as const;
type Zoom = (typeof ZOOMS)[number];

export function PosterView({ posters }: { posters: ReviewPoster[] }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<Zoom>(ZOOMS[0]);
  const poster = posters[index];

  const step = (delta: number) => {
    setIndex((current) => (current + delta + posters.length) % posters.length);
    setZoom(ZOOMS[0]); // 다음 장은 다시 전체가 보여야 한다 — 확대된 채 넘어가면 어디를 보는지 모른다
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* 확대는 이미지에만 있다 — PDF·그 밖의 형식은 브라우저 보기 도구가 자기 확대를 갖는다 */}
          {poster.kind === "image" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(nextZoom(zoom))}
              aria-label="포스터 확대"
            >
              {zoom === 1 ? "확대" : `${zoom}배 — 다시 맞춤`}
            </Button>
          )}
          <a
            href={poster.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-primary underline underline-offset-2"
          >
            새 탭 ↗
          </a>
          {poster.kind !== "image" && (
            <span className="text-xs text-muted-foreground">
              {poster.kind === "pdf" ? "PDF" : "이 형식은 여기서 못 엽니다"}
            </span>
          )}
        </div>
        {posters.length > 1 && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => step(-1)}>
              이전
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {index + 1} / {posters.length}
            </span>
            <Button variant="outline" size="sm" onClick={() => step(1)}>
              다음
            </Button>
          </div>
        )}
      </div>

      <div className="mt-2 overflow-auto rounded-xl border bg-muted/30">
        <PosterBody poster={poster} zoom={zoom} />
      </div>
    </div>
  );
}

function PosterBody({ poster, zoom }: { poster: ReviewPoster; zoom: Zoom }) {
  if (poster.kind === "image") {
    return (
      // next/image를 쓰지 않는다 — 30분 만료 signed URL이라 최적화 캐시 키가 매번 달라져
      // 이득 없이 함수만 돈다. 크기도 모른다(게시판 포스터는 비율이 제각각).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={poster.path}
        src={poster.url}
        alt="포스터"
        className="block h-auto max-w-none"
        style={{ width: `${zoom * 100}%` }}
      />
    );
  }
  if (poster.kind === "pdf") {
    // 브라우저 기본 PDF 보기 도구가 뜬다(자체 확대·페이지 이동을 갖는다)
    return (
      <iframe key={poster.path} src={poster.url} title="포스터 PDF" className="h-[70dvh] w-full" />
    );
  }
  return (
    <p className="p-3 text-xs leading-relaxed break-keep text-muted-foreground">
      이 형식은 화면에서 열 수 없습니다 — <b className="text-foreground">새 탭</b>으로 내려받아
      확인해 주세요.
    </p>
  );
}

function nextZoom(current: Zoom): Zoom {
  return ZOOMS[(ZOOMS.indexOf(current) + 1) % ZOOMS.length];
}
