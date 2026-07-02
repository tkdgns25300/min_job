import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChurchDetailView } from "./church-detail-view";
import { churchMetaLine } from "@/lib/format";
import { getChurch, getChurchTimeline } from "@/lib/queries/churches";
import { getChurchOpenJobs } from "@/lib/queries/jobs";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const church = await getChurch(id);
  if (!church) return { title: "교회를 찾을 수 없습니다 | 민잡" };

  const openCount = (await getChurchOpenJobs(id)).length;
  const description = `${church.name} (${churchMetaLine(church)}) 교역자 청빙${
    openCount > 0 ? ` · 현재 ${openCount}건 모집 중` : ""
  }. 교회 정보·채널·재공고 이력을 민잡에서 확인하세요.`;
  return {
    title: `${church.name} 청빙 | 민잡`,
    description,
    openGraph: { title: `${church.name} 청빙`, description, type: "profile" },
  };
}

// 교회 상세도 빌드타임 prerender 안 함 — params 의존 동적 렌더를 Suspense로 감싼다.
export default function ChurchDetailPage({ params }: Params) {
  return (
    <Suspense fallback={<ChurchDetailSkeleton />}>
      <ChurchDetailContent params={params} />
    </Suspense>
  );
}

async function ChurchDetailContent({ params }: Params) {
  const { id } = await params;
  const church = await getChurch(id);
  if (!church) notFound();

  const openJobs = await getChurchOpenJobs(id);
  const timeline = await getChurchTimeline(id);

  return <ChurchDetailView church={church} openJobs={openJobs} timeline={timeline} />;
}

function ChurchDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6">
      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      <div className="h-16 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
