import { cn } from "@/lib/utils";

// 상태 탭 + 건수 배지 — 교회 공고 목록·운영자 공고 관리·인증 검수 셋이 같은 것을 따로 만들고
// 있었다(CLAUDE.md 배치 규칙: 두 곳 이상이면 페이지 폴더 밖으로). 패딩과 overflow가 곳마다 달라
// 탭이 많아지면 어떤 화면은 넘치고 어떤 화면은 스크롤됐다.
//
// key 타입이 화면마다 다르므로(공고 상태 vs 인증 상태) 제네릭으로 받는다. 건수는 부모가 넘긴다 —
// 무엇을 세는지는 화면별 도메인 규칙이다.
export function TabBar<K extends string>({
  tabs,
  active,
  counts,
  onChange,
}: {
  tabs: readonly { key: K; label: string }[];
  active: K;
  counts: Record<K, number>;
  onChange: (key: K) => void;
}) {
  return (
    // 모바일에서 탭이 줄바꿈되지 않고 옆으로 스크롤되게 한다(CLAUDE 모바일 퍼스트)
    <div className="flex gap-1 overflow-x-auto border-b">
      {tabs.map(({ key, label }) => {
        const on = key === active;
        return (
          <button
            key={key}
            type="button"
            // 제자리 필터 토글이라 aria-pressed다. aria-current는 페이지 이동용이고,
            // role="tab"은 화살표 키 탐색까지 구현해야 하는 계약이다(ChipSelect와 같은 선택).
            aria-pressed={on}
            onClick={() => onChange(key)}
            className={cn(
              "relative -mb-px flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-bold whitespace-nowrap transition-colors",
              on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {counts[key]}
            </span>
            {on && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}
