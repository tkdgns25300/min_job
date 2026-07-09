"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

// /pricing "이렇게 노출됩니다" — 상품별 미리보기 갤러리.
// PC/모바일 토글 + 캐러셀(옆으로 넘기기) + 라이트박스(탭 확대·좌우·키보드·ESC).
// 장면(scene)은 실제 사이트 디자인 근사 — 마케팅 일러스트라 컴포넌트 내부 전용.

type Device = "mobile" | "pc";

// 장면 논리 너비(px). 썸네일은 이 너비를 축소, 라이트박스는 원본 너비.
const DEVICE: Record<Device, { w: number; thumbW: number; label: string }> = {
  mobile: { w: 340, thumbW: 188, label: "모바일" },
  pc: { w: 940, thumbW: 306, label: "PC" },
};
const THUMB_H = 244;

// ---------- 장면 primitives (딥그린 헤더·공고 카드 등) ----------
function Chrome({ device, url, children }: { device: Device; url: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden bg-[#f4f6f5]" style={{ width: DEVICE[device].w }}>
      <div className="flex items-center gap-2 border-b border-black/10 bg-white px-3 py-1.5">
        <span className="flex gap-1">
          <i className="size-1.5 rounded-full bg-neutral-300" />
          <i className="size-1.5 rounded-full bg-neutral-300" />
          <i className="size-1.5 rounded-full bg-neutral-300" />
        </span>
        <span className="rounded bg-[#eef0ef] px-2 py-0.5 text-[10px] text-muted-foreground">
          {url}
        </span>
      </div>
      <div className="flex items-center gap-3 bg-[#15332a] px-3.5 py-2.5 text-white">
        <span className="text-[14px] font-extrabold">
          Min<span className="text-gold">Job</span>
        </span>
        <span className="text-[12px] text-white/80">공고</span>
        <span className="ml-auto text-[12px] text-white/80">로그인</span>
      </div>
      {children}
    </div>
  );
}

function Card({
  church,
  title,
  role,
  pay,
  tag,
  variant = "plain",
}: {
  church: string;
  title: string;
  role?: string;
  pay?: string;
  tag?: "광고" | "대표광고";
  variant?: "plain" | "ad" | "top";
}) {
  const border =
    variant === "top"
      ? "border-[1.5px] border-gold bg-[#fffdf5]"
      : variant === "ad"
        ? "border-primary/50 bg-[#fbfdfc] shadow-[0_0_0_1px_rgba(47,93,80,.12)]"
        : "border-border bg-white";
  return (
    <div className={`rounded-[10px] border p-2.5 ${border}`}>
      <div className="text-[10.5px] text-muted-foreground">{church}</div>
      <div className="mt-0.5 text-[13px] leading-snug font-extrabold break-keep">
        {title}
        {tag && (
          <span
            className={`ml-1.5 rounded-[5px] px-1.5 py-px align-middle text-[9px] font-extrabold ${
              tag === "대표광고" ? "bg-gold/30 text-[#8a6d2f]" : "bg-primary/15 text-primary"
            }`}
          >
            {tag}
          </span>
        )}
      </div>
      {role && <div className="mt-0.5 text-[11px] text-muted-foreground">{role}</div>}
      {pay && <div className="mt-1.5 text-[12.5px] font-extrabold text-primary">{pay}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2.5 mb-1 text-[10px] font-extrabold text-muted-foreground">{children}</div>
  );
}

// ---------- 장면들 ----------
type Scene = { cap: string; node: ReactNode };

function buildScenes(device: Device): { premium: Scene[]; hero: Scene[] } {
  const isPc = device === "pc";
  const gridCols = isPc ? "grid-cols-2" : "grid-cols-1";

  const premiumListCard = (
    <Card
      church="새벽빛교회 · 예장백석 · 경기 수원"
      title="청년부 전도사 청빙"
      role="전도사 · 청년부 · 전임"
      pay="월 210만원"
      tag="광고"
      variant="ad"
    />
  );

  const premium: Scene[] = [
    {
      cap: "프리미엄 · 목록 상단",
      node: (
        <Chrome device={device} url="minjob.kr/jobs">
          <div className="border-b border-border bg-primary/5 px-3.5 py-3">
            <div className="text-[14px] font-extrabold">사역자 청빙 공고</div>
            <div className="mt-0.5 text-[11px] font-bold text-primary">모집 중 74건</div>
          </div>
          <div className={`grid gap-2 p-3.5 ${gridCols}`}>
            {premiumListCard}
            <Card
              church="동산교회 · 예장합동 · 서울 관악"
              title="유초등부 전도사"
              role="전도사 · 유초등부"
              pay="월 220만원"
            />
            <Card
              church="은혜교회 · 예장통합 · 인천"
              title="교구 담당 부목사"
              role="부목사 · 장년·교구"
              pay="월 295만원"
            />
            {isPc && (
              <Card
                church="주안에교회 · 경기 용인"
                title="중고등부 전도사"
                role="전도사 · 중고등부"
                pay="월 230만원"
              />
            )}
          </div>
        </Chrome>
      ),
    },
    {
      cap: "프리미엄 · 검색·필터 결과 상단",
      node: (
        <Chrome device={device} url="minjob.kr/jobs?q=수원 전도사">
          <div className="p-3.5">
            <div className="rounded-full border border-border bg-white px-3.5 py-2 text-[11.5px] text-muted-foreground">
              🔍 수원 전도사
            </div>
            <SectionLabel>검색결과 3건</SectionLabel>
            <div className={`grid gap-2 ${gridCols}`}>
              {premiumListCard}
              <Card
                church="빛된교회 · 예장합동 · 경기 수원"
                title="수원 유년부 전도사"
                role="전도사 · 유년부"
                pay="월 200만원"
              />
            </div>
          </div>
        </Chrome>
      ),
    },
    {
      cap: "프리미엄 · 비슷한 공고 슬롯",
      node: (
        <Chrome device={device} url="minjob.kr/jobs/job-021">
          <div className="p-3.5">
            <div className="rounded-[10px] border border-border bg-white p-2.5 text-[11px] text-muted-foreground">
              <div className="text-[12.5px] font-extrabold text-foreground">교육부 전도사 청빙</div>
              새소망교회 · 경기 성남 · 전임 · 월 220만원
            </div>
            <SectionLabel>비슷한 공고</SectionLabel>
            <div className={`grid gap-2 ${isPc ? "grid-cols-3" : "grid-cols-2"}`}>
              <Card church="새벽빛교회 · 경기 수원" title="청년부 전도사" tag="광고" variant="ad" />
              <Card church="경기 용인" title="중고등부 전도사" />
              <Card church="서울 관악" title="유초등부 전도사" />
              {isPc && <Card church="경기 성남" title="영아부 전도사" />}
            </div>
          </div>
        </Chrome>
      ),
    },
  ];

  const hero: Scene[] = [
    {
      cap: "대표광고 · 홈 배너",
      node: (
        <Chrome device={device} url="minjob.kr">
          <div
            className="bg-hero px-4 py-5 text-center text-white"
            style={isPc ? { paddingTop: 34, paddingBottom: 34 } : undefined}
          >
            <div className="text-[9.5px] font-bold text-gold">한국교회 사역자 청빙 플랫폼</div>
            <div
              className={`mt-1.5 font-extrabold leading-tight ${isPc ? "text-[24px]" : "text-[16px]"}`}
            >
              다음 사역지, 여기서 찾으세요
            </div>
            <div
              className={`mx-auto mt-3 rounded-full bg-white px-3 py-1.5 text-left text-[10.5px] text-muted-foreground ${isPc ? "max-w-[420px]" : ""}`}
            >
              🔍 지역·교단·직분으로 검색
            </div>
          </div>
          <div className="p-3.5">
            <div className="rounded-[11px] bg-gradient-to-br from-[#234f41] to-[#15332a] p-3 text-white">
              <div className="text-[9px] font-extrabold text-gold">대표광고</div>
              <div className="mt-0.5 text-[13px] font-extrabold">
                청년부 전도사 청빙 · 새벽빛교회
              </div>
              <div className="mt-0.5 text-[10px] text-white/70">경기 수원 · 전임 · 월 210만원</div>
            </div>
            <SectionLabel>최신 공고</SectionLabel>
            <div className={`grid gap-2 ${gridCols}`}>
              <Card church="동산교회 · 서울 관악" title="유초등부 전도사" pay="월 220만원" />
              {isPc && <Card church="은혜교회 · 인천" title="교구 담당 부목사" pay="월 295만원" />}
            </div>
          </div>
        </Chrome>
      ),
    },
    {
      cap: "대표광고 · 목록 맨 위 대표 슬롯",
      node: (
        <Chrome device={device} url="minjob.kr/jobs">
          <div className="border-b border-border bg-primary/5 px-3.5 py-3">
            <div className="text-[14px] font-extrabold">사역자 청빙 공고</div>
            <div className="mt-0.5 text-[11px] font-bold text-primary">모집 중 74건</div>
          </div>
          <div className="p-3.5">
            <Card
              church="새벽빛교회 · 예장백석 · 경기 수원"
              title="청년부 전도사 청빙"
              role="전도사 · 청년부 · 전임"
              pay="월 210만원"
              tag="대표광고"
              variant="top"
            />
            <SectionLabel>공고</SectionLabel>
            <div className={`grid gap-2 ${gridCols}`}>
              <Card
                church="동산교회 · 서울 관악"
                title="유초등부 전도사"
                role="프리미엄"
                pay="월 220만원"
                tag="광고"
                variant="ad"
              />
              <Card church="은혜교회 · 인천" title="교구 담당 부목사" pay="월 295만원" />
            </div>
          </div>
        </Chrome>
      ),
    },
  ];

  return { premium, hero };
}

// ---------- 그룹 헤더 ----------
function GroupHead({
  tag,
  gold,
  title,
  cap,
}: {
  tag: string;
  gold?: boolean;
  title: string;
  cap: string;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${gold ? "bg-gold/20 text-[#8a6d2f]" : "bg-primary/10 text-primary"}`}
        >
          {tag}
        </span>
        <b className="text-[15px] font-extrabold">{title}</b>
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
          옆으로 넘기기 · 탭하면 확대
        </span>
      </div>
      <p className="mt-1 mb-3 text-[12.5px] break-keep text-muted-foreground">{cap}</p>
    </>
  );
}

// ---------- 캐러셀 ----------
function Carousel({
  scenes,
  device,
  onOpen,
}: {
  scenes: Scene[];
  device: Device;
  onOpen: (i: number) => void;
}) {
  const { w, thumbW } = DEVICE[device];
  const scale = thumbW / w;
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-1 pt-1 pb-3">
      {scenes.map((s, i) => (
        <button
          key={s.cap}
          type="button"
          onClick={() => onOpen(i)}
          className="group shrink-0 snap-start text-left"
        >
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-white transition-shadow group-hover:shadow-lg"
            style={{ width: thumbW, height: THUMB_H }}
          >
            <div style={{ width: w, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              {s.node}
            </div>
            <span className="absolute right-2 bottom-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
              ⤢ 크게
            </span>
          </div>
          <div className="mt-1.5 text-center text-[11.5px] font-bold">{s.cap.split(" · ")[1]}</div>
        </button>
      ))}
    </div>
  );
}

export function ExposurePreview() {
  const [device, setDevice] = useState<Device>("mobile");
  const [open, setOpen] = useState<{ group: "premium" | "hero"; i: number } | null>(null);
  const scenes = useMemo(() => buildScenes(device), [device]);

  const current = open ? scenes[open.group] : null;
  const close = useCallback(() => setOpen(null), []);
  const move = useCallback(
    (d: number) =>
      setOpen((o) => {
        if (!o) return o;
        const n = scenes[o.group].length;
        return { ...o, i: (o.i + d + n) % n };
      }),
    [scenes],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, move]);

  return (
    <div>
      {/* 디바이스 토글 */}
      <div className="mb-4 inline-flex rounded-full border border-border bg-card p-1 text-sm">
        {(Object.keys(DEVICE) as Device[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDevice(d)}
            aria-pressed={device === d}
            className={`rounded-full px-4 py-1.5 font-semibold transition-colors ${
              device === d ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {DEVICE[d].label}
          </button>
        ))}
      </div>

      <GroupHead
        tag="프리미엄"
        title="어디서 찾든 상단에"
        cap="같은 공고가 목록·검색·비슷한 공고 세 자리에 “광고” 표시로 상단 노출."
      />
      <Carousel
        scenes={scenes.premium}
        device={device}
        onOpen={(i) => setOpen({ group: "premium", i })}
      />

      <div className="mt-8">
        <GroupHead
          tag="대표광고"
          gold
          title="가장 눈에 띄는 자리"
          cap="홈 배너와 목록 맨 위 대표 슬롯. 소수 구좌만(매진제)."
        />
        <Carousel
          scenes={scenes.hero}
          device={device}
          onOpen={(i) => setOpen({ group: "hero", i })}
        />
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        위계: <b className="text-foreground">대표광고(최상단) &gt; 프리미엄(상단) &gt; 일반</b>
      </p>

      {/* 라이트박스 */}
      {open && current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="노출 미리보기"
          onClick={close}
          className="fixed inset-0 z-50 flex flex-col bg-black/92"
        >
          <div className="flex items-center justify-between px-5 py-4 text-white">
            <span className="text-sm font-semibold">
              {current[open.i].cap}
              <span className="ml-2 text-white/55 tabular-nums">
                {open.i + 1} / {current.length}
              </span>
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
            className="relative flex flex-1 items-center justify-center overflow-auto px-4 pb-6"
          >
            {current.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => move(-1)}
                  aria-label="이전"
                  className="absolute left-3 z-10 flex size-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  aria-label="다음"
                  className="absolute right-3 z-10 flex size-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
                >
                  ›
                </button>
              </>
            )}
            <div
              className="overflow-hidden rounded-xl shadow-2xl"
              style={{ width: DEVICE[device].w, maxWidth: "100%" }}
            >
              {current[open.i].node}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
