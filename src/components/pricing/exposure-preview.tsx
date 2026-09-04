"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  buildScenes,
  DEVICE,
  GROUP_TITLE,
  type Device,
  type Group,
  type Scene,
} from "./exposure-scenes";

// /pricing 상품 카드의 "노출 화면 미리보기" — 버튼 → 풀스크린 모달.
// 모달: PC/모바일 토글(뷰포트 기본) + 전체 페이지 장면을 한 화면씩 넘기기(스와이프·화살표·점).

// ---------- 한 화면씩 넘기는 캐러셀 (자체 폭 측정) ----------
function Carousel({ scenes, device }: { scenes: Scene[]; device: Device }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const count = scenes.length;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 장면(고정 논리 폭)을 컨테이너 폭에 맞춰 zoom. 모바일은 살짝 확대 허용, PC는 원본까지만.
  const rawScale = containerWidth > 0 ? containerWidth / DEVICE[device].w : 1;
  const scale = device === "mobile" ? Math.min(rawScale, 1.4) : Math.min(rawScale, 1.05);

  const onScroll = () => {
    const el = trackRef.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goto = (target: number) => {
    const el = trackRef.current;
    if (el)
      el.scrollTo({
        left: Math.max(0, Math.min(count - 1, target)) * el.clientWidth,
        behavior: "smooth",
      });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {scenes.map((s) => (
            <div key={s.cap} className="w-full flex-none snap-center overflow-y-auto">
              <div className="flex justify-center py-1">
                <div style={{ zoom: scale, width: DEVICE[device].w }}>{s.node}</div>
              </div>
            </div>
          ))}
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goto(index - 1)}
              disabled={index === 0}
              aria-label="이전"
              className="absolute top-1/2 left-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-xl shadow-md transition-opacity hover:bg-muted disabled:opacity-0"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goto(index + 1)}
              disabled={index === count - 1}
              aria-label="다음"
              className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-xl shadow-md transition-opacity hover:bg-muted disabled:opacity-0"
            >
              ›
            </button>
          </>
        )}
      </div>
      <div className="pt-3 text-center">
        <div className="text-sm font-bold">{scenes[index]?.cap}</div>
        {/* 그림 아래 설명 — 점선 테두리가 가리키는 자리가 누구에게 닿는지(`Scene.desc`).
            본문 크기(`text-sm`)로 둔다 — 이 모달에서 유일한 설명인데 캡션보다 작으면 안 읽힌다 */}
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed break-keep text-muted-foreground">
          {scenes[index]?.desc}
        </p>
        {count > 1 && (
          <div className="mt-2 flex justify-center gap-1.5">
            {scenes.map((s, k) => (
              <button
                key={s.cap}
                type="button"
                onClick={() => goto(k)}
                aria-label={`${k + 1}번째`}
                aria-current={index === k}
                className={`h-1.5 rounded-full transition-all ${index === k ? "w-5 bg-primary" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 뷰포트 → 기본 디바이스(useSyncExternalStore = SSR·lint 안전). 토글이 있으면 override.
const PC_MQ = "(min-width: 768px)";
const subscribePc = (cb: () => void) => {
  const mq = window.matchMedia(PC_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getPcSnapshot = () => window.matchMedia(PC_MQ).matches;
const getPcServer = () => false;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function PreviewButton({ group }: { group: Group }) {
  const [open, setOpen] = useState(false);
  const isPc = useSyncExternalStore(subscribePc, getPcSnapshot, getPcServer);
  const [override, setOverride] = useState<Device | null>(null);
  const device: Device = override ?? (isPc ? "pc" : "mobile");
  const scenes = useMemo(() => buildScenes(device), [device]);
  const dialogRef = useRef<HTMLDivElement>(null);

  // 열림 동안: 스크롤 잠금 + ESC 닫기 + 포커스 진입/트랩/복귀
  useEffect(() => {
    if (!open) return;
    const restoreTo = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreTo?.focus?.();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-xl border border-primary/40 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        노출 화면 미리보기
      </button>

      {open &&
        createPortal(
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={GROUP_TITLE[group]}
            tabIndex={-1}
            className="fixed inset-0 z-50 flex flex-col bg-background outline-none"
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <b className="text-sm font-bold sm:text-base">{GROUP_TITLE[group]}</b>
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs sm:text-sm">
                  {(Object.keys(DEVICE) as Device[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setOverride(d)}
                      aria-pressed={device === d}
                      className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                        device === d
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {DEVICE[d].label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                  className="text-2xl leading-none text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-4 sm:p-6">
              <Carousel scenes={scenes[group]} device={device} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
