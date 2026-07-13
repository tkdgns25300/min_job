import type { ReactNode } from "react";

// /pricing 노출 미리보기의 "장면" — 실제 페이지 주요 섹션을 담은 근사(마케팅 일러스트).
// 인터랙션 없는 순수 프레젠테이션. 셸(캐러셀·모달)은 exposure-preview.tsx.

export type Device = "mobile" | "pc";
export type Group = "premium" | "hero";
export type Scene = { cap: string; node: ReactNode };

export const DEVICE: Record<Device, { w: number; label: string }> = {
  mobile: { w: 360, label: "모바일 화면" },
  pc: { w: 980, label: "PC 화면" },
};

export const GROUP_TITLE: Record<Group, string> = {
  premium: "프리미엄 노출 미리보기",
  hero: "대표광고 노출 미리보기",
};

// ---------- 장면 primitives ----------
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
      <div className="flex items-center gap-3 bg-brand-900 px-3.5 py-2.5 text-white">
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
        ? "border-primary/50 bg-[#fbfdfc] ring-1 ring-primary/10"
        : "border-border bg-white";
  return (
    <div className={`rounded-[10px] border p-2.5 ${border}`}>
      <div className="text-[10.5px] text-muted-foreground">{church}</div>
      <div className="mt-0.5 text-[13px] leading-snug font-extrabold break-keep">
        {title}
        {tag && (
          <span
            className={`ml-1.5 rounded-[5px] px-1.5 py-px align-middle text-[9px] font-extrabold ${
              tag === "대표광고" ? "bg-gold/30 text-gold-ink" : "bg-primary/15 text-primary"
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

function Band({ children }: { children: ReactNode }) {
  return <div className="border-b border-border bg-primary/5 px-3.5 py-3">{children}</div>;
}
function SearchPill({ text }: { text: string }) {
  return (
    <div className="rounded-full border border-border bg-white px-3.5 py-2 text-[11.5px] text-muted-foreground">
      🔍 {text}
    </div>
  );
}
function Toolbar({ sort }: { sort: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2 text-[10.5px] text-muted-foreground">
      <span>정렬 · {sort} ▾</span>
      <span>20개씩 ▾</span>
    </div>
  );
}
function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 px-3.5 pt-1">
      {items.map((c) => (
        <span
          key={c}
          className="rounded-full border border-border bg-white px-2 py-0.5 text-[10px] text-muted-foreground"
        >
          {c}
        </span>
      ))}
    </div>
  );
}
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 mb-1 text-[10px] font-extrabold text-muted-foreground">{children}</div>
  );
}
function Pager() {
  return (
    <div className="flex justify-center gap-2 py-3 text-[11px] text-muted-foreground">
      <span>‹</span>
      <span className="font-bold text-primary">1</span>
      <span>2</span>
      <span>3</span>
      <span>4</span>
      <span>›</span>
    </div>
  );
}

const FILTERS = ["지역 ▾", "교단 ▾", "직분 ▾", "부서 ▾", "자격 ▾", "사택 ▾"];

// ---------- 장면들 (페이지 전체 섹션, footer 제외) ----------
export function buildScenes(device: Device): Record<Group, Scene[]> {
  const isPc = device === "pc";
  const grid = isPc ? "grid-cols-2" : "grid-cols-1";
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
  const normalCards = (
    <>
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
      <Card
        church="주안에교회 · 예장통합 · 경기 용인"
        title="중고등부 전도사"
        role="전도사 · 중고등부"
        pay="월 230만원"
      />
      <Card
        church="한빛교회 · 예장합동 · 경기 성남"
        title="찬양 사역자"
        role="전도사 · 찬양"
        pay="월 210만원"
      />
    </>
  );

  const premium: Scene[] = [
    {
      cap: "공고 목록 페이지 — 상단 고정",
      node: (
        <Chrome device={device} url="minjob.kr/jobs">
          <Band>
            <div className="text-[15px] font-extrabold">사역자 청빙 공고</div>
            <div className="mt-0.5 mb-2 text-[11px] font-bold text-primary">모집 중 74건</div>
            <SearchPill text="지역·교단·직분으로 검색" />
          </Band>
          <Chips items={FILTERS} />
          <Toolbar sort="최신순" />
          <div className={`grid gap-2 px-3.5 ${grid}`}>
            {premiumAd}
            {normalCards}
          </div>
          <Pager />
        </Chrome>
      ),
    },
    {
      cap: "검색 결과 페이지 — 상단",
      node: (
        <Chrome device={device} url="minjob.kr/jobs">
          <Band>
            <SearchPill text="수원 전도사" />
            <div className="mt-2 text-[11px] font-bold text-primary">검색결과 3건</div>
          </Band>
          <Chips items={["경기 수원 ✕", "전도사 ✕"]} />
          <Toolbar sort="관련순" />
          <div className={`grid gap-2 px-3.5 pb-4 ${grid}`}>
            {premiumAd}
            <Card
              church="빛된교회 · 예장합동 · 경기 수원"
              title="수원 유년부 전도사"
              role="전도사 · 유년부"
              pay="월 200만원"
            />
            <Card
              church="수원제일교회 · 예장통합 · 경기 수원"
              title="장년부 부목사"
              role="부목사 · 장년"
              pay="월 300만원"
            />
          </div>
        </Chrome>
      ),
    },
    {
      cap: "공고 상세 페이지 — 하단 ‘비슷한 공고’",
      node: (
        <Chrome device={device} url="minjob.kr/jobs/job-021">
          <div className={`p-3.5 ${isPc ? "grid grid-cols-[1.6fr_1fr] gap-3" : ""}`}>
            <div>
              <div className="text-[10.5px] text-muted-foreground">
                새소망교회 · 예장합동 · 경기 성남
              </div>
              <div className="mt-1 text-[16px] font-extrabold">교육부 전도사 청빙</div>
              <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                <span className="rounded bg-[#eef0ef] px-1.5 py-0.5">전도사</span>
                <span className="rounded bg-[#eef0ef] px-1.5 py-0.5">교육부</span>
                <span className="rounded bg-[#eef0ef] px-1.5 py-0.5">전임</span>
              </div>
              <SectionLabel>모집 조건</SectionLabel>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div>사례비 · 월 220만원</div>
                <div>출근 · 주일·수요</div>
                <div>자격 · 교육 전도사 우대</div>
              </div>
              <SectionLabel>지원 방법</SectionLabel>
              <div className="rounded-[8px] border border-border bg-white p-2 text-[10.5px] text-muted-foreground">
                교회 공개 접수처로 안내 · 원문 링크
              </div>
            </div>
            {isPc && (
              <div className="rounded-[10px] border border-border bg-white p-3">
                <div className="rounded-[8px] bg-primary py-2 text-center text-[11px] font-bold text-white">
                  지원하기
                </div>
                <div className="mt-2 space-y-1 text-[10.5px] text-muted-foreground">
                  <div>사례비 · 월 220만원</div>
                  <div>마감 · 상시</div>
                  <div>고용 · 전임</div>
                </div>
              </div>
            )}
          </div>
          <div className="px-3.5 pb-4">
            <SectionLabel>비슷한 공고</SectionLabel>
            <div className={`grid gap-2 ${isPc ? "grid-cols-3" : "grid-cols-2"}`}>
              <Card church="새벽빛교회 · 경기 수원" title="청년부 전도사" tag="광고" variant="ad" />
              <Card church="경기 용인" title="중고등부 전도사" />
              <Card church="서울 관악" title="유초등부 전도사" />
              <Card church="경기 성남" title="영아부 전도사" />
            </div>
          </div>
        </Chrome>
      ),
    },
  ];

  const hero: Scene[] = [
    {
      cap: "홈 화면 — 대표 배너",
      node: (
        <Chrome device={device} url="minjob.kr">
          <div
            className="bg-hero px-4 py-6 text-center text-white"
            style={isPc ? { paddingTop: 44, paddingBottom: 44 } : undefined}
          >
            <div className="text-[9.5px] font-bold text-gold">한국교회 사역자 청빙 플랫폼</div>
            <div
              className={`mt-1.5 font-extrabold leading-tight ${isPc ? "text-[26px]" : "text-[17px]"}`}
            >
              다음 사역지, 여기서 찾으세요
            </div>
            <div
              className={`mx-auto mt-3 rounded-full bg-white px-3 py-2 text-left text-[10.5px] text-muted-foreground ${isPc ? "max-w-[440px]" : ""}`}
            >
              🔍 지역·교단·직분으로 검색
            </div>
            <div className="mt-4 flex justify-center gap-5 text-[10px] text-white/70">
              <span>
                <b className="text-[13px] text-white">74</b> 모집 중
              </span>
              <span>
                <b className="text-[13px] text-white">12</b> 이번 주 새 공고
              </span>
              <span>
                <b className="text-[13px] text-white">35</b> 교회
              </span>
            </div>
          </div>
          <div className="p-3.5">
            <div className="rounded-[11px] bg-gradient-to-br from-brand-700 to-brand-900 p-3.5 text-white">
              <div className="text-[9px] font-extrabold text-gold">대표광고</div>
              <div className="mt-0.5 text-[13px] font-extrabold">
                청년부 전도사 청빙 · 새벽빛교회
              </div>
              <div className="mt-0.5 text-[10px] text-white/70">경기 수원 · 전임 · 월 210만원</div>
            </div>
            <SectionLabel>추천 공고</SectionLabel>
            <div className={`grid gap-2 ${grid}`}>
              <Card
                church="빛된교회 · 경기 수원"
                title="장년부 부목사"
                role="프리미엄"
                pay="월 300만원"
                tag="광고"
                variant="ad"
              />
              <Card church="한빛교회 · 경기 성남" title="찬양 사역자" pay="월 210만원" />
            </div>
            <SectionLabel>최신 공고</SectionLabel>
            <div className={`grid gap-2 ${grid}`}>
              <Card church="동산교회 · 서울 관악" title="유초등부 전도사" pay="월 220만원" />
              <Card church="은혜교회 · 인천" title="교구 담당 부목사" pay="월 295만원" />
            </div>
          </div>
        </Chrome>
      ),
    },
    {
      cap: "공고 목록 페이지 — 맨 위 대표 슬롯",
      node: (
        <Chrome device={device} url="minjob.kr/jobs">
          <Band>
            <div className="text-[15px] font-extrabold">사역자 청빙 공고</div>
            <div className="mt-0.5 mb-2 text-[11px] font-bold text-primary">모집 중 74건</div>
            <SearchPill text="지역·교단·직분으로 검색" />
          </Band>
          <Chips items={FILTERS} />
          <Toolbar sort="최신순" />
          <div className="px-3.5">
            <Card
              church="새벽빛교회 · 예장백석 · 경기 수원"
              title="청년부 전도사 청빙"
              role="전도사 · 청년부 · 전임"
              pay="월 210만원"
              tag="대표광고"
              variant="top"
            />
          </div>
          <div className={`grid gap-2 px-3.5 pt-2 ${grid}`}>
            <Card
              church="동산교회 · 서울 관악"
              title="유초등부 전도사"
              role="프리미엄"
              pay="월 220만원"
              tag="광고"
              variant="ad"
            />
            {normalCards}
          </div>
          <Pager />
        </Chrome>
      ),
    },
  ];

  return { premium, hero };
}
