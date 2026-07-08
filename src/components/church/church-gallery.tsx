"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const MAX_STRIP_THUMBS = 3; // 커버 아래 썸네일 스트립에 노출할 최대 장수 (나머지는 +N)

// 교회 사진 갤러리 — 커버(클릭 시 확대) + 썸네일 스트립 + 라이트박스(좌우·키보드·ESC).
// 사진 있는 교회에서만 렌더 → client 경계를 이 컴포넌트로 좁힘. 첫 장이 커버.
export function ChurchGallery({
  photos,
  name,
  meta,
}: {
  photos: string[];
  name: string;
  meta: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isOpen = openIndex !== null;

  const close = useCallback(() => setOpenIndex(null), []);
  const move = useCallback(
    (delta: number) =>
      setOpenIndex((i) => (i === null ? i : (i + delta + photos.length) % photos.length)),
    [photos.length],
  );

  // 라이트박스 열림 동안 body 스크롤 잠금 + 키보드 네비
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close, move]);

  const cover = photos[0];
  const thumbs = photos.slice(1, 1 + MAX_STRIP_THUMBS); // 커버 외 스트립
  const hidden = photos.length - 1 - thumbs.length; // 스트립에 못 담은 나머지 (+N)

  return (
    <div>
      {/* 커버 — 전체가 확대 트리거(0). 뒤 버튼 위에 오버레이(그라데이션·이름은 클릭 통과) */}
      <div className="relative overflow-hidden rounded-2xl">
        <button
          type="button"
          onClick={() => setOpenIndex(0)}
          aria-label="사진 크게 보기"
          className="block h-56 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${cover})` }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <Link
          href="/jobs"
          className="absolute top-4 left-4 text-sm text-white/85 transition-colors hover:text-white"
        >
          ← 목록으로
        </Link>
        <span className="pointer-events-none absolute top-4 right-4 rounded-lg bg-black/40 px-2.5 py-1 text-xs font-semibold text-white">
          사진 {photos.length}
        </span>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-6">
          <h1 className="text-2xl leading-snug font-bold break-keep text-white">{name}</h1>
          <p className="mt-1 text-sm text-white/85">{meta}</p>
        </div>
      </div>

      {/* 썸네일 스트립 (커버 외 사진) */}
      {thumbs.length > 0 && (
        <div className="mt-2 flex gap-2">
          {thumbs.map((src, i) => {
            const index = i + 1;
            const isLast = i === thumbs.length - 1 && hidden > 0;
            return (
              <button
                key={`${src}-${index}`}
                type="button"
                onClick={() => setOpenIndex(index)}
                aria-label={`사진 ${index + 1} 보기`}
                className="relative h-16 flex-1 overflow-hidden rounded-lg bg-cover bg-center transition-opacity hover:opacity-85"
                style={{ backgroundImage: `url(${src})` }}
              >
                {isLast && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold text-white">
                    +{hidden}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 라이트박스 */}
      {openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name} 사진`}
          onClick={close}
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
        >
          <div className="flex items-center justify-between px-5 py-4 text-white">
            <span className="text-sm font-semibold tabular-nums">
              {openIndex + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="닫기"
              className="text-2xl leading-none text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-1 items-center justify-center px-4 pb-6"
          >
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => move(-1)}
                  aria-label="이전 사진"
                  className="absolute left-4 flex size-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition-colors hover:bg-white/25"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  aria-label="다음 사진"
                  className="absolute right-4 flex size-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition-colors hover:bg-white/25"
                >
                  ›
                </button>
              </>
            )}
            <div
              className="h-full max-h-[72vh] w-full max-w-3xl rounded-xl bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${photos[openIndex]})` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
