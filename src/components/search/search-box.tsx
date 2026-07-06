"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  addRecentSearch,
  clearRecentSearches,
  readRecentSearches,
  removeRecentSearch,
} from "@/lib/recent-searches";
import { readRecentJobs, type RecentJob } from "@/lib/recent-jobs";

const MAX_SUGGESTIONS = 7;

// 입력이 후보의 앞부분(prefix)이면 우선, 그다음 부분 포함(substring). 후보는 이미 공고 수 순 정렬.
function matchSuggestions(all: string[], query: string): string[] {
  const prefix: string[] = [];
  const substr: string[] = [];
  for (const term of all) {
    const idx = term.indexOf(query);
    if (idx === 0) prefix.push(term);
    else if (idx > 0) substr.push(term);
  }
  return [...prefix, ...substr].slice(0, MAX_SUGGESTIONS);
}

function Highlight({ text, query }: { text: string; query: string }) {
  const idx = text.indexOf(query);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <b className="font-bold">{text.slice(idx, idx + query.length)}</b>
      {text.slice(idx + query.length)}
    </>
  );
}

/**
 * 홈 히어로 검색창 + 드롭다운 오버레이.
 * 빈 상태 = 최근 검색어 + 최근 본 공고(둘 다 localStorage). 타이핑 중 = 검색어 완성(suggestions 매칭).
 * 선택/제출 시 /jobs?q= 로 이동. suggestions는 서버에서 만든 후보 어휘.
 */
export function SearchBox({ suggestions }: { suggestions: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  // 마운트 시 localStorage 로드 (SSR엔 없음)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentSearches(readRecentSearches());
    setRecentJobs(readRecentJobs());
  }, []);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const query = q.trim();
  const matches = query ? matchSuggestions(suggestions, query) : [];

  const go = (term: string) => {
    const t = term.trim();
    setOpen(false);
    if (!t) {
      router.push("/jobs");
      return;
    }
    addRecentSearch(t);
    setRecentSearches(readRecentSearches());
    router.push(`/jobs?q=${encodeURIComponent(t)}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 한글 IME 조합 중(글자 완성 전)의 Enter·방향키는 무시 — 조합 확정용 키를 검색 실행으로 오인 방지
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!query || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      go(matches[active]);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="flex w-full items-center gap-1.5 rounded-2xl bg-white p-1.5 shadow-xl shadow-black/10"
      >
        <div className="flex flex-1 items-center gap-2 pl-3">
          <Search className="size-[18px] shrink-0 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="교회명 · 지역 · 직분 검색"
            aria-label="공고 검색"
            aria-expanded={open}
            className="h-11 flex-1 border-0 bg-transparent px-0 text-[15.5px] shadow-none focus-visible:ring-0"
          />
        </div>
        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-primary px-6 font-bold text-primary-foreground transition-colors hover:bg-brand-700"
        >
          검색
        </button>
      </form>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border bg-background p-1.5 text-left shadow-lg">
          {query ? (
            <SuggestionList matches={matches} query={query} active={active} onPick={go} />
          ) : (
            <EmptyState
              searches={recentSearches}
              jobs={recentJobs}
              onPick={go}
              onRemove={(term) => setRecentSearches(removeRecentSearch(term))}
              onClear={() => {
                clearRecentSearches();
                setRecentSearches([]);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionList({
  matches,
  query,
  active,
  onPick,
}: {
  matches: string[];
  query: string;
  active: number;
  onPick: (term: string) => void;
}) {
  return (
    <ul role="listbox" className="flex flex-col">
      {matches.map((term, i) => (
        <li key={term} role="option" aria-selected={i === active}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(term)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm hover:bg-muted",
              i === active && "bg-muted",
            )}
          >
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              <Highlight text={term} query={query} />
            </span>
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(query)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm hover:bg-muted",
            matches.length > 0 && "mt-1 border-t border-border pt-3",
          )}
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            &lsquo;<b className="font-bold">{query}</b>&rsquo; 전체 결과 보기
          </span>
          <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground/60" />
        </button>
      </li>
    </ul>
  );
}

function EmptyState({
  searches,
  jobs,
  onPick,
  onRemove,
  onClear,
}: {
  searches: string[];
  jobs: RecentJob[];
  onPick: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
}) {
  if (searches.length === 0 && jobs.length === 0) {
    return (
      <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
        교회명 · 지역 · 직분으로 검색해보세요
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {searches.length > 0 && (
        <section className="px-1 py-1.5">
          <div className="mb-2 flex items-center justify-between px-1.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Clock className="size-3.5" /> 최근 검색어
            </span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClear}
              className="text-xs text-muted-foreground/70 hover:text-foreground"
            >
              전체 삭제
            </button>
          </div>
          <ul className="flex flex-wrap gap-1.5 px-1.5">
            {searches.map((term) => (
              <li key={term}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1.5 pr-1.5 pl-3 text-sm text-foreground/80">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPick(term)}
                    className="hover:text-foreground"
                  >
                    {term}
                  </button>
                  <button
                    type="button"
                    aria-label={`${term} 삭제`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onRemove(term)}
                    className="text-muted-foreground/60 hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {jobs.length > 0 && (
        <section
          className={cn("px-1 py-1.5", searches.length > 0 && "mt-1 border-t border-border pt-2.5")}
        >
          <p className="mb-1.5 px-2.5 text-xs font-bold text-muted-foreground">최근 본 공고</p>
          <ul className="flex flex-col">
            {jobs.slice(0, 5).map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-muted"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-muted text-xs font-bold text-muted-foreground">
                    {(job.subtitle ?? job.title).charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{job.title}</span>
                    {job.subtitle && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {job.subtitle}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground/40" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
