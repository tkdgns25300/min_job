"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { TabBar } from "@/components/tab-bar";
import { NativeSelect } from "@/components/ui/native-select";
import { ReviewRowItem } from "./review-row";
import { boardLabel } from "@/constants/review";
import { ATTENTION_KINDS, type AttentionKind } from "@/lib/review-flags";
import type { ReviewRow } from "@/lib/queries/review";

// 큐는 서버가 이미 `review_status='PENDING'`으로 걸러 왔다 — 여기 필터는 **그 위에 얹는 것**이고
// 대체하지 않는다(크롤러 SPEC §3: 큐 조건은 그 하나뿐이다).
type Tab = "queue" | "done";

const TABS: readonly { key: Tab; label: string }[] = [
  { key: "queue", label: "검수 큐" },
  { key: "done", label: "처리한 것" },
];

export function ReviewQueueView({
  queue,
  done,
  doneTotal,
  pending,
  reviewedToday,
}: {
  queue: ReviewRow[];
  done: ReviewRow[];
  /** 처리한 것의 실제 개수 — `done`은 잘려 오므로 탭에 `done.length`를 쓰면 상한에서 멈춘다 */
  doneTotal: number;
  /** 남은 것의 실제 개수 — `queue`도 잘려 온다(같은 이유) */
  pending: number;
  reviewedToday: number;
}) {
  const [tab, setTab] = useState<Tab>("queue");
  const [kind, setKind] = useState<AttentionKind | "all">("all");
  const [board, setBoard] = useState("all");
  const [q, setQ] = useState("");

  const rows = tab === "queue" ? queue : done;

  // 게시판 선택지는 **지금 화면에 있는 값에서** 만든다 — 고정 목록을 두면 게시판이 31곳으로
  // 늘 때마다 손대야 한다. 확인 필요 유형은 반대로 고정이다: 화면에 있는 것만 모으면 첫 100건에
  // 없는 유형이 **선택지에 아예 나타나지 않아** 그 유형만 골라 보는 일이 불가능해진다.
  // 키를 앞세운다 — 운영자는 `CSU`로 기억하고 이름으로 확인한다. 정렬도 키 순(앞에 오는 값 순).
  const boardOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.source.source_key))]
        .sort()
        // 이름을 아직 안 넣은 게시판은 `boardLabel`이 키를 그대로 돌려준다 — `KEY · KEY`가 되지 않게
        .map((key) => {
          const name = boardLabel(key);
          return { key, label: name === key ? key : `${key} · ${name}` };
        }),
    [rows],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== "all" && !r.attention.some((a) => a.kind === kind)) return false;
      if (board !== "all" && r.source.source_key !== board) return false;
      if (query && !`${r.row.church_name ?? ""} ${r.row.title ?? ""}`.toLowerCase().includes(query))
        return false;
      return true;
    });
  }, [rows, kind, board, q]);

  return (
    <div>
      {/* 남은 것 / 오늘 처리 — 끝이 보이지 않으면 손을 못 댄다(크롤러 SPEC §4.5) */}
      <dl className="mb-5 flex w-fit items-baseline gap-5 rounded-xl border bg-card px-5 py-3">
        <div>
          <dt className="text-[11px] font-bold tracking-wide text-muted-foreground">남은 것</dt>
          <dd className="text-2xl font-bold tabular-nums">{pending}</dd>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <dt className="text-[11px] font-bold tracking-wide text-muted-foreground">오늘 처리</dt>
          <dd className="text-2xl font-bold tabular-nums">{reviewedToday}</dd>
        </div>
      </dl>

      <TabBar
        tabs={TABS}
        active={tab}
        // 탭 건수는 **전체 수**다 — 목록은 잘려 오므로 `length`를 쓰면 상한에서 멈춘다
        counts={{ queue: pending, done: doneTotal }}
        onChange={(key) => {
          setTab(key);
          // 탭마다 있는 게시판·유형이 달라 선택값이 남으면 결과가 0건이 된다
          setKind("all");
          setBoard("all");
        }}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="확인 필요 유형 필터"
          className="w-auto"
          value={kind}
          onChange={(e) => setKind(attentionKindOf(e.target.value))}
        >
          <option value="all">확인 필요 유형 전체</option>
          {ATTENTION_KINDS.map(({ kind: key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="게시판 필터"
          className="w-auto"
          value={board}
          onChange={(e) => setBoard(e.target.value)}
        >
          <option value="all">게시판 전체</option>
          {boardOptions.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <Input
          className="h-9 w-full sm:w-56"
          type="search"
          placeholder="교회명·제목 검색"
          aria-label="검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
        {filtered.length === 0 ? (
          <EmptyState tab={tab} hasRows={rows.length > 0} />
        ) : (
          <ul className="divide-y">
            {filtered.map((r) => (
              <li key={r.row.id}>
                <ReviewRowItem item={r} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 잘린 것을 말하지 않으면 "이게 전부"로 읽힌다 */}
      {rows.length < (tab === "queue" ? pending : doneTotal) && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {tab === "queue" ? "오래된" : "최근"} {rows.length}건만 보여줍니다 (전체{" "}
          {tab === "queue" ? pending : doneTotal}건). 처리하면 다음 건이 올라옵니다.
        </p>
      )}
    </div>
  );
}

/** select 값 좁히기 — 캐스트를 한 곳에 가둔다(`lib/domain-enum`의 `keyOf`와 같은 관용구) */
function attentionKindOf(value: string): AttentionKind | "all" {
  const hit = ATTENTION_KINDS.find((option) => option.kind === value);
  return hit ? hit.kind : "all";
}

/**
 * 빈 큐는 **오류가 아니다** — 크롤러가 대부분(실측 77%)을 자동 승인하므로 정상적으로 자주 빈다.
 * 필터 때문에 0건인 것과 구분해서 말해 준다(아니면 "일이 없다"로 잘못 읽는다).
 */
function EmptyState({ tab, hasRows }: { tab: Tab; hasRows: boolean }) {
  // 행은 있는데 0건이면 필터 탓이다 — 빈 큐와 구분해서 말해야 "일이 없다"로 잘못 읽지 않는다
  if (hasRows) {
    return (
      <p className="px-4 py-14 text-center text-sm text-muted-foreground">
        조건에 맞는 공고가 없어요. 필터를 지워 보세요.
      </p>
    );
  }
  return (
    <div className="px-4 py-14 text-center">
      <p className="font-bold">
        {tab === "queue" ? "검수할 공고가 없어요" : "아직 처리한 공고가 없어요"}
      </p>
      {tab === "queue" && (
        <p className="mt-1 text-sm text-muted-foreground">
          오류가 아니에요 — 크롤러가 대부분을 자동 승인하므로 자주 비어 있습니다.
        </p>
      )}
    </div>
  );
}
