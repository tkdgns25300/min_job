import type { ReactNode } from "react";
import { SITE_DOMAIN } from "@/constants/site";

// /pricing 노출 미리보기의 "장면" — 실제 페이지 주요 섹션을 담은 근사(마케팅 일러스트).
// 인터랙션 없는 순수 프레젠테이션. 셸(캐러셀·모달)은 exposure-preview.tsx.
// 자리 셋(홈 추천 카드 · 목록 상단 로우 · 비슷한 공고 첫 칸)을 **실제 컴포넌트와 같은 모양**으로 그린다 —
// 카드·로우 모양, 회색 "광고" 텍스트 하나. 등급명·틴트는 실제 화면에 없으니 여기도 없다(2026-09-03).

export type Device = "mobile" | "pc";
export type Group = "basic" | "plus" | "special";
/**
 * 장면 하나 — `cap`은 어느 화면의 어느 자리인지(한 줄), `desc`는 **그 자리가 실제로 어떻게 동작하는지**
 * (몇 칸 · 누가 서나 · 순서 · 광고 표시). 그림만 두면 광고 줄을 눈으로 찾아야 해서 붙였다(운영자 요청 2026-09-05).
 * ⚠️ `desc`의 수치는 `constants/domain`의 정원·자리 규칙과 `lib/similar-jobs`·`queries/jobs` 머리말의 말이다 —
 *    규칙이 바뀌면 여기도 같이 고친다.
 */
export type Scene = { cap: string; desc: string; node: ReactNode };

export const DEVICE: Record<Device, { w: number; label: string }> = {
  mobile: { w: 360, label: "모바일 화면" },
  pc: { w: 980, label: "PC 화면" },
};

export const GROUP_TITLE: Record<Group, string> = {
  basic: "기본 노출 미리보기",
  plus: "플러스 노출 미리보기",
  special: "스페셜 노출 미리보기",
};

// ---------- 장면 primitives ----------
function Chrome({ device, url, children }: { device: Device; url: string; children: ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-white text-left"
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

interface Posting {
  title: string;
  meta: string;
  role?: string;
  pay: string;
  time: string;
}

const AdText = () => <span className="text-[9px] font-medium text-muted-foreground">광고</span>;
const BookmarkGlyph = () => <span className="text-[11px] text-neutral-300">▢</span>;

// 홈 추천 카드·비슷한 공고 카드 — `components/job/job-card`의 축소판
// 광고 자리 강조 — **미리보기에만** 있는 표시다. 실제 화면은 회색 "광고" 글자 하나뿐이라 그림에서 그 줄을 눈으로
// 찾아야 했다. 점선 테두리로 "여기"를 가리키고, 테두리 안쪽 모양은 실제와 같게 둔다.
const AD_HIGHLIGHT = "outline-2 outline-offset-1 outline-dashed outline-primary/50";

function MiniCard({ posting, ad = false }: { posting: Posting; ad?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-[10px] border border-border bg-white p-2.5 ${ad ? AD_HIGHLIGHT : ""}`}
    >
      {/* 실제 카드(`components/job/job-card`)와 같은 줄 구성 — 제목 오른쪽에 "광고"·저장 */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="text-[12px] leading-snug font-bold break-keep">{posting.title}</div>
        <div className="flex shrink-0 items-center gap-1">
          {ad ? <AdText /> : null}
          <BookmarkGlyph />
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground">{posting.meta}</div>
      {posting.role ? (
        <div className="text-[10px] text-muted-foreground">{posting.role}</div>
      ) : null}
      <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5">
        <span className="text-[11px] font-bold text-primary">{posting.pay}</span>
        <span className="text-[9px] text-muted-foreground">{posting.time}</span>
      </div>
    </div>
  );
}

// 목록 로우 — `components/job/job-row`의 축소판
function Row({ posting, ad = false }: { posting: Posting; ad?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 border-t border-border px-3 py-2.5 first:border-t-0 ${ad ? AD_HIGHLIGHT : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-bold">{posting.title}</span>
          {ad ? <AdText /> : null}
        </div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{posting.meta}</div>
        {posting.role ? (
          <div className="text-[10px] text-muted-foreground">{posting.role}</div>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[11px] font-bold text-primary">{posting.pay}</div>
        <div className="text-[9px] text-muted-foreground">{posting.time}</div>
      </div>
      <BookmarkGlyph />
    </div>
  );
}

function ListBox({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-white">{children}</div>
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
// 실제 /jobs 툴바를 축소 재현 — 정렬 선택은 없다(최신순 고정, SPEC 정렬·필터 규칙).
// 총 건수는 광고 로우를 빼고 센다(실제 화면과 같게).
function Toolbar({ total }: { total: number }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2 text-[10.5px] text-muted-foreground">
      <span>총 {total}건</span>
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
function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[12px] font-bold">{children}</div>;
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

// 가상 공고 — 실제 교회가 아니다(마케팅 일러스트). 광고 자리에 서는 것은 `mine`.
const mine: Posting = {
  title: "새벽빛교회에서 청년부 전도사를 모십니다",
  meta: "경기 수원시 · 새벽빛교회 · 예장백석",
  role: "전도사 · 청년부 · 전임",
  pay: "월 210만원",
  time: "오늘",
};
const others: Posting[] = [
  {
    title: "동산교회 유초등부 전도사 청빙",
    meta: "서울 관악구 · 동산교회 · 예장합동",
    role: "전도사 · 유초등부",
    pay: "월 220만원",
    time: "어제",
  },
  {
    title: "은혜교회에서 교구 담당 부목사님을 모십니다",
    meta: "인천 · 은혜교회 · 예장통합",
    role: "부목사 · 장년·교구 · 전임",
    pay: "월 295만원",
    time: "2일 전",
  },
  {
    title: "주안에교회 중고등부 전도사 모집",
    meta: "경기 용인시 · 주안에교회 · 예장통합",
    role: "전도사 · 중고등부",
    pay: "월 230만원",
    time: "3일 전",
  },
  {
    title: "한빛교회 찬양 사역자를 찾습니다",
    meta: "경기 성남시 · 한빛교회 · 예장합동",
    role: "찬양·예배",
    pay: "협의",
    time: "3일 전",
  },
  {
    title: "빛된교회 유년부 전도사 청빙",
    meta: "경기 수원시 · 빛된교회 · 예장합동",
    role: "전도사 · 유초등부 · 파트",
    pay: "월 120만원",
    time: "4일 전",
  },
];

// ---------- 장면들 (페이지 전체 섹션, footer 제외) ----------
export function buildScenes(device: Device): Record<Group, Scene[]> {
  const isPc = device === "pc";
  const cardGrid = isPc ? "grid-cols-3" : "grid-cols-1";

  // 비슷한 공고 첫 칸 — 세 등급 모두 걸리는 자리(기본은 이것 하나)
  const related: Scene = {
    cap: "공고 상세 — 하단 ‘비슷한 공고’ 첫 칸",
    desc: "다른 공고를 읽는 사람에게 닿는 자리예요. 같은 지역이고 같은 자격으로 갈 수 있는 공고의 상세 아래, ‘비슷한 공고’ 6칸 중 첫 칸에 서요. 기본·플러스·스페셜 모두 서고, 해당하는 광고가 여럿이면 페이지마다 다른 하나가 서요.",
    node: (
      <Chrome device={device} url="/jobs/…">
        <div className="p-3.5">
          <div className="text-[10.5px] text-muted-foreground">
            경기 수원시 · 새소망교회 · 예장합동
          </div>
          <div className="mt-1 text-[16px] font-extrabold">교육부 전도사 청빙</div>
          <div className="mt-1.5 text-[10.5px] text-muted-foreground">전도사 · 교육부 · 전임</div>
          <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            <div>사례비 · 월 220만원</div>
            <div>출근 · 주일·수요</div>
            <div>지원 · 교회 공개 접수처로 안내</div>
          </div>
        </div>
        <div className="mx-3.5 border-t border-border pt-3 pb-4">
          <div className="flex items-baseline justify-between">
            <SectionTitle>비슷한 공고</SectionTitle>
            <span className="text-[10px] font-semibold text-primary underline">더 보기 →</span>
          </div>
          <div className={`grid gap-2 ${cardGrid}`}>
            <MiniCard posting={mine} ad />
            {others.slice(0, isPc ? 5 : 2).map((p) => (
              <MiniCard key={p.title} posting={p} />
            ))}
          </div>
        </div>
      </Chrome>
    ),
  };

  // 목록 1페이지 맨 위 로우 — 플러스·스페셜
  const list: Scene = {
    cap: "공고 목록 — 1페이지 맨 위 광고 로우",
    desc: "공고 목록 1페이지 맨 위에 최대 5줄이 서요. 스페셜 3줄, 그 아래 플러스 2줄이에요. 사용자가 지역·직분 필터를 걸어도 그 조건에 맞는 공고면 그대로 맨 위에 남아요. 줄 모양은 일반 목록과 같고 ‘광고’ 표시만 붙어요.",
    node: (
      <Chrome device={device} url="/jobs">
        <Band>
          <div className="text-[15px] font-extrabold">사역자 청빙</div>
          <div className="mt-0.5 mb-2 text-[11px] font-bold text-primary">지금 모집 중 889건</div>
          <SearchPill text="교회명 · 공고 제목 · 지역 · 직분 검색" />
        </Band>
        <Chips items={FILTERS} />
        <Toolbar total={887} />
        <div className="px-3.5">
          <ListBox>
            <Row posting={mine} ad />
            <Row posting={others[4]} ad />
            {others.slice(0, isPc ? 4 : 3).map((p) => (
              <Row key={p.title} posting={p} />
            ))}
          </ListBox>
        </div>
        <Pager />
      </Chrome>
    ),
  };

  // 홈 추천 청빙 3칸 — 스페셜만
  const home: Scene = {
    cap: "홈 — 첫 화면 ‘추천 청빙’ 카드",
    desc: "홈에 들어오면 가장 먼저 보이는 추천 청빙 3칸이에요. 스페셜 공고만 서고, 셋을 넘으면 최신순으로 3장까지예요. 카드에 ‘광고’ 표시가 작게 붙고, 모양은 다른 카드와 같아요.",
    node: (
      <Chrome device={device} url={SITE_DOMAIN}>
        <div
          className="bg-hero px-4 py-6 text-center text-white"
          style={isPc ? { paddingTop: 40, paddingBottom: 40 } : undefined}
        >
          <div className="text-[9.5px] font-bold text-gold">한국교회 사역자 청빙 플랫폼</div>
          <div
            className={`mt-1.5 font-extrabold leading-tight ${isPc ? "text-[26px]" : "text-[17px]"}`}
          >
            다음 사역지, 여기에서 찾으세요
          </div>
          <div
            className={`mx-auto mt-3 rounded-full bg-white px-3 py-2 text-left text-[10.5px] text-muted-foreground ${isPc ? "max-w-[440px]" : ""}`}
          >
            🔍 지역·교단·직분으로 검색
          </div>
        </div>
        <div className="p-3.5">
          <SectionTitle>추천 청빙</SectionTitle>
          <div className={`grid gap-2 ${cardGrid}`}>
            <MiniCard posting={mine} ad />
            {isPc ? (
              <>
                <MiniCard posting={others[1]} ad />
                <MiniCard posting={others[2]} ad />
              </>
            ) : null}
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <SectionTitle>청빙 공고</SectionTitle>
            <span className="text-[10px] text-muted-foreground">전체 공고 보기 →</span>
          </div>
          <ListBox>
            {others.slice(0, isPc ? 3 : 2).map((p) => (
              <Row key={p.title} posting={p} />
            ))}
          </ListBox>
        </div>
      </Chrome>
    ),
  };

  // 등급별 장면 = 그 등급이 걸리는 자리(SPEC 수익화 절): 기본 1 · 플러스 2 · 스페셜 3
  return { basic: [related], plus: [list, related], special: [home, list, related] };
}
