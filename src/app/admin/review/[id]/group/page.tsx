import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { seatLabel } from "@/components/admin/review-row";
import { DEPARTMENTS } from "@/constants/domain";
import { requireOperator } from "@/lib/auth-guard";
import { enumLabel } from "@/lib/domain-enum";
import { getReviewGroup, getReviewRow } from "@/lib/queries/review";
import { GroupView } from "./group-view";

export const metadata: Metadata = { title: "묶음 판정 | 민잡 운영자" };

// 묶음 판정 — `dedup_state='UNCERTAIN'`인 건만 온다. 라우트를 `dedup_key`가 아니라 **구성원 id**로
// 잡은 이유 둘: 판정 대상이 특정 구성원 하나이고, `dedup_key`엔 교회명(한글)이 들어가 URL에
// 쓰지 않는 값이다(CLAUDE.md 네이밍: 라우트 id는 영어만).
export default function ReviewGroupPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
      <Suspense fallback={<GroupSkeleton />}>
        <GroupContent params={params} />
      </Suspense>
    </div>
  );
}

async function GroupContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 운영자 전용 · 미검수 데이터 — proxy가 1차로 막지만 여기서도 다시 확인한다(fail-closed).
  await requireOperator();

  const row = await getReviewRow(id);
  if (!row) notFound();
  // 묶을 것이 없는 건은 여기서 볼 것이 없다 — 단건 화면이 맞다(직접 URL을 친 경우)
  if (row.dedup_state !== "UNCERTAIN" || row.dedup_key === null) redirect(`/admin/review/${id}`);

  const members = await getReviewGroup(row.dedup_key);
  const target = members.find((m) => m.row.id === id);
  // 묶음 키는 매 실행 다시 계산된다 — 그 사이 이 건의 키가 바뀌었으면 목록으로 돌려보낸다
  if (!target) redirect("/admin/review");

  return (
    <>
      <nav className="text-xs">
        <Link href="/admin/review" className="font-semibold text-primary">
          ← 큐로
        </Link>
      </nav>

      <header className="mt-4">
        <p className="text-xs font-bold text-primary">{row.church_name ?? "교회명 없음"}</p>
        {/* 제목에 자리 이름을 넣지 않는다 — 직분이 `ETC`면 "기타 — 같은 자리인가"가 되어
            무슨 화면인지 알 수 없다. 묻는 것은 늘 같으므로 **건수**로 말한다 */}
        <h1 className="mt-0.5 text-xl font-bold tracking-tight break-keep">
          이 {members.length}건이 같은 자리인가?
        </h1>
        <p className="mt-1 text-sm break-keep text-muted-foreground">
          {[seatLabel(row, { full: true }), enumLabel(DEPARTMENTS, row.department)]
            .filter(Boolean)
            .join(" · ") || "자리 미상"}{" "}
          — 크롤러가 <b>같은 자리인지 스스로 정할 수 없다</b>고 넘긴 건입니다. 한 건씩 보면 판단이
          안 되므로 묶음을 나란히 놓습니다.
        </p>
      </header>

      <div className="mt-4">
        <GroupView members={members} target={target} />
      </div>
    </>
  );
}

function GroupSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-14 w-80 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
