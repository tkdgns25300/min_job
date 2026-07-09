"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

// /pricing "이렇게 노출됩니다" — 상품별 미리보기.
// 환경에 맞춰 기본 디바이스 자동 선택(PC/모바일) + 토글로 둘 다 열람.
// 한 화면씩 꽉 차게(컨테이너 폭에 zoom 맞춤) + 옆으로 넘기기(스와이프·화살표·점).
// 장면(scene)은 실제 사이트 디자인 근사 — 마케팅 일러스트라 컴포넌트 내부 전용.

type Device = "mobile" | "pc";

// 장면 논리 너비(px) — 컨테이너 폭에 맞춰 zoom으로 확대/축소.
const DEVICE: Record<Device, { w: number; label: string }> = {
  mobile: { w: 340, label: "모바일 화면" },
  pc: { w: 960, label: "PC 화면" },
};

// ---------- 장면 primitives (딥그린 헤더·공고 카드 등) ----------
function Chrome({ device, url, children }: { device: Device; url: string; children: ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-[#f4f6f5]"
      style={{ width: DEVICE[device].w }}
    >
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

  const premiumAd = (
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
      cap: "목록 상단",
      node: (
        <Chrome device={device} url="minjob.kr/jobs">
          <div className="border-b border-border bg-primary/5 px-3.5 py-3">
            <div className="text-[14px] font-extrabold">사역자 청빙 공고</div>
            <div className="mt-0.5 text-[11px] font-bold text-primary">모집 중 74건</div>
          </div>
          <div className={`grid gap-2 p-3.5 ${gridCols}`}>
            {premiumAd}
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
      cap: "검색·필터 결과 상단",
      node: (
        <Chrome device={device} url="minjob.kr/jobs?q=수원 전도사">
          <div className="p-3.5">
            <div className="rounded-full border border-border bg-white px-3.5 py-2 text-[11.5px] text-muted-foreground">
              🔍 수원 전도사
            </div>
            <SectionLabel>검색결과 3건</SectionLabel>
            <div className={`grid gap-2 ${gridCols}`}>
              {premiumAd}
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
      cap: "비슷한 공고 슬롯",
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
      cap: "홈 배너",
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
      cap: "목록 맨 위 대표 슬롯",
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

// ---------- 한 화면씩 넘기는 캐러셀 ----------
function Carousel({ scenes, device, scale }: { scenes: Scene[]; device: Device; scale: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const n = scenes.length;

  const onScroll = () => {
    const el = ref.current;
    if (el) setI(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goto = (k: number) => {
    const el = ref.current;
    if (el)
      el.scrollTo({ left: Math.max(0, Math.min(n - 1, k)) * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {scenes.map((s) => (
          <div key={s.cap} className="w-full flex-none snap-center">
            <div className="flex justify-center">
              <div style={{ zoom: scale, width: DEVICE[device].w }}>{s.node}</div>
            </div>
            <div className="mt-3 text-center text-[13px] font-bold">{s.cap}</div>
          </div>
        ))}
      </div>

      {/* 화살표 (넘기기) */}
      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => goto(i - 1)}
            disabled={i === 0}
            aria-label="이전"
            className="absolute top-1/2 left-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-lg shadow-sm transition-opacity hover:bg-muted disabled:opacity-0"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goto(i + 1)}
            disabled={i === n - 1}
            aria-label="다음"
            className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-lg shadow-sm transition-opacity hover:bg-muted disabled:opacity-0"
          >
            ›
          </button>
        </>
      )}

      {/* 점 인디케이터 */}
      {n > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {scenes.map((s, k) => (
            <button
              key={s.cap}
              type="button"
              onClick={() => goto(k)}
              aria-label={`${k + 1}번째`}
              className={`h-1.5 rounded-full transition-all ${i === k ? "w-5 bg-primary" : "w-1.5 bg-border"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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
      </div>
      <p className="mt-1 mb-4 text-[12.5px] break-keep text-muted-foreground">{cap}</p>
    </>
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

export function ExposurePreview() {
  const isPc = useSyncExternalStore(subscribePc, getPcSnapshot, getPcServer);
  const [override, setOverride] = useState<Device | null>(null);
  const device: Device = override ?? (isPc ? "pc" : "mobile");
  const [cw, setCw] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scenes = useMemo(() => buildScenes(device), [device]);

  // 컨테이너 폭 측정 → 장면을 폭에 맞춰 zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const raw = cw > 0 ? cw / DEVICE[device].w : 1;
  const scale = device === "mobile" ? Math.min(raw, 1.15) : Math.min(raw, 1);

  return (
    <div ref={wrapRef}>
      {/* 디바이스 토글 (어느 환경에서든 두 버전 열람) */}
      <div className="mb-5 inline-flex rounded-full border border-border bg-card p-1 text-sm">
        {(Object.keys(DEVICE) as Device[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setOverride(d)}
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
      <Carousel scenes={scenes.premium} device={device} scale={scale} />

      <div className="mt-10">
        <GroupHead
          tag="대표광고"
          gold
          title="가장 눈에 띄는 자리"
          cap="홈 배너와 목록 맨 위 대표 슬롯. 소수 구좌만(매진제)."
        />
        <Carousel scenes={scenes.hero} device={device} scale={scale} />
      </div>

      <p className="mt-6 text-[12.5px] text-muted-foreground">
        위계: <b className="text-foreground">대표광고(최상단) &gt; 프리미엄(상단) &gt; 일반</b>
      </p>
    </div>
  );
}
