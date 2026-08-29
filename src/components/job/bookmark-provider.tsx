"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { loginPathWithNext } from "@/lib/auth";

// 저장한 공고(북마크)의 클라이언트 단일 소스 — 저장 버튼 세 곳(목록 행·홈 카드·상세 헤더)과
// 마이페이지의 "저장 해제"가 전부 여기만 본다.
//
// **왜 컨텍스트인가**: 홈·`/jobs`·상세는 `'use cache'`로 모든 방문자가 같은 HTML을 받는다 — "이 사람이
// 저장했나"를 서버가 그 HTML에 그릴 수 없다. 그래서 헤더의 세션 hole(`HeaderAccount`)이 로그인한
// 사람의 id 집합을 `<BookmarkSeed>`로 흘려 넣고, 버튼들은 그 집합만 본다. 페이지 셸은 계속 프리렌더된다.
// ⚠️ **액션은 prop으로 받는다** — `components/`가 `app/`을 import하지 않게(레이아웃이 넘긴다).
// ⚠️ **비로그인은 누르면 로그인으로** 간다(2026-08-28 결정 · A안). 액션이 `login`을 돌려주면 현재
//    경로를 `?next=`에 실어 보낸다 — 로그인 뒤 그 자리로 돌아오고, 다시 눌러 저장한다.
// ⚠️ 실패는 토스트다 — 아이콘 버튼엔 인라인 문구를 둘 자리가 없다(링크 복사 실패와 같은 예외).
//    성공은 아이콘이 채워지는 것으로 말한다.
// ⛔ **`useSearchParams`·`usePathname`을 쓰지 않는다.** 이 provider는 레이아웃에 있어 프리렌더되는
//    모든 공개 페이지를 감싼다 — 거기서 `useSearchParams`를 읽으면 그 트리 전체가 dynamic hole이 되어
//    `/jobs`의 목록 HTML이 프리렌더에서 빠진다. 복귀 경로는 **누르는 순간** `window.location`에서 읽는다
//    (이벤트 핸들러 = 브라우저에서만 돈다).

/**
 * 저장 액션의 결과 — **타입은 여기가 정본**이고 액션(`mypage/actions.ts`)이 import한다. 반대로 하면
 * `components/`가 `app/`을 참조하게 된다(타입만이라도 층이 뒤집힌다).
 * `login` = 세션이 없다 — 액션이 `redirect`하지 않고 알려 주어야 여기서 되돌리고 복귀 경로를 실을 수 있다.
 */
export type BookmarkResult =
  { kind: "saved"; saved: boolean } | { kind: "login" } | { kind: "error"; message: string };

type SetBookmark = (jobId: string, saved: boolean) => Promise<BookmarkResult>;

interface Bookmarks {
  /** 저장한 공고 id. `null` = 아직 모른다(비로그인이거나 seed 전) — 버튼은 비어 있는 모양 */
  ids: ReadonlySet<string> | null;
  isSaved: (jobId: string) => boolean;
  toggle: (jobId: string) => void;
  seed: (ids: string[]) => void;
}

const BookmarkContext = createContext<Bookmarks | null>(null);

export function BookmarkProvider({
  setBookmark,
  children,
}: {
  setBookmark: SetBookmark;
  children: ReactNode;
}) {
  const [ids, setIds] = useState<ReadonlySet<string> | null>(null);
  const router = useRouter();

  const seed = useCallback((next: string[]) => setIds(new Set(next)), []);

  const toggle = useCallback(
    (jobId: string) => {
      const wasSaved = ids?.has(jobId) ?? false;
      const next = !wasSaved;
      // 낙관적 갱신 — 누른 즉시 채우고, 서버가 거절하면 되돌린다
      setIds((current) => {
        const draft = new Set(current ?? []);
        if (next) draft.add(jobId);
        else draft.delete(jobId);
        return draft;
      });

      const revert = () =>
        setIds((current) => {
          const draft = new Set(current ?? []);
          if (wasSaved) draft.add(jobId);
          else draft.delete(jobId);
          return draft;
        });

      void setBookmark(jobId, next)
        .then((result) => {
          if (result.kind === "saved") return;
          revert();
          if (result.kind === "login") {
            const { pathname, search } = window.location;
            router.push(loginPathWithNext(`${pathname}${search}`));
          } else {
            toast.error(result.message);
          }
        })
        .catch((thrown: unknown) => {
          revert();
          console.error("[bookmarks] 저장 실패", thrown);
          toast.error("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        });
    },
    [ids, router, setBookmark],
  );

  const value = useMemo<Bookmarks>(
    () => ({ ids, isSaved: (jobId) => ids?.has(jobId) ?? false, toggle, seed }),
    [ids, toggle, seed],
  );

  return <BookmarkContext.Provider value={value}>{children}</BookmarkContext.Provider>;
}

export function useBookmarks(): Bookmarks {
  const context = useContext(BookmarkContext);
  // 저장 버튼이 provider 밖(예: admin)에서 그려지면 조용히 죽는 대신 바로 알린다
  if (!context) throw new Error("useBookmarks는 <BookmarkProvider> 안에서만 쓸 수 있다");
  return context;
}

/**
 * 서버가 읽은 id 집합을 컨텍스트에 심는다 — `HeaderAccount`(세션 hole)가 로그인한 사람에게만 그린다.
 * 렌더링은 없다. 헤더는 레이아웃에 있어 그룹 안 이동에서는 다시 그려지지 않고, 그 사이 변화는
 * `toggle`이 컨텍스트에 직접 반영한다.
 */
export function BookmarkSeed({ ids }: { ids: string[] }) {
  const { seed } = useBookmarks();
  useEffect(() => {
    seed(ids);
  }, [seed, ids]);
  return null;
}
