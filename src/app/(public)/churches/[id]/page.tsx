import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChurchDetailView } from "./church-detail-view";
import { breadcrumbJsonLd } from "@/lib/seo";
import { churchMetaLine } from "@/lib/format";
import { getChurch, getChurchPastJobs } from "@/lib/queries/churches";
import { getChurchOpenJobs } from "@/lib/queries/jobs";
import { SITE_OPEN_GRAPH } from "@/constants/site";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const church = await getChurch(id);
  if (!church) return { title: "교회를 찾을 수 없습니다" };

  const openCount = (await getChurchOpenJobs(id)).length;
  // 교단·지역이 모두 미상이면 괄호를 통째로 뺀다 — "○○교회 () 교역자 청빙"이 검색결과에 나간다
  const meta = churchMetaLine(church);
  const description = `${church.name}${meta ? ` (${meta})` : ""} 교역자 청빙${
    openCount > 0 ? ` · 현재 ${openCount}건 모집 중` : ""
  }. 교회 정보·채널·지난 공고를 민잡에서 확인하세요.`;
  return {
    title: `${church.name} 청빙`,
    description,
    openGraph: { ...SITE_OPEN_GRAPH, title: `${church.name} 청빙`, description, type: "profile" },
    alternates: { canonical: `/churches/${id}` },
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
  const pastJobs = await getChurchPastJobs(id);

  return (
    <>
      {/* BreadcrumbList JSON-LD — 교회 목록 페이지는 없으므로 공고 목록을 상위로 둔다
          (구직자는 공고에서 교회로 들어온다 — SPEC 교회 상세 진입 경로) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([{ name: "청빙 공고", path: "/jobs" }, { name: church.name }]),
          ),
        }}
      />
      <ChurchDetailView church={church} openJobs={openJobs} pastJobs={pastJobs} />
    </>
  );
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
