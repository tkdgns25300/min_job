import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { JobDetailView } from "./job-detail-view";
import { RecordRecentlyViewed } from "@/components/job/record-recently-viewed";
import { getChurchOtherJobs, getJobDetail, getRepost, getSimilarJobs } from "@/mocks";
import { jobPostingJsonLd, jobRoleSummary } from "@/lib/seo";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const detail = getJobDetail(id);
  if (!detail) return { title: "공고를 찾을 수 없습니다 | 민잡" };

  const description = detail.job.description ?? jobRoleSummary(detail);
  return {
    title: `${detail.job.title} | 민잡`,
    description,
    openGraph: { title: detail.job.title, description, type: "article" },
  };
}

// 상세는 빌드타임 prerender 안 함 — params 의존 동적 렌더를 Suspense로 감싼다.
// (추후 on-demand 'use cache'로 전환: Phase 1 실데이터)
export default function JobDetailPage({ params }: Params) {
  return (
    <Suspense fallback={<JobDetailSkeleton />}>
      <JobDetailContent params={params} />
    </Suspense>
  );
}

async function JobDetailContent({ params }: Params) {
  const { id } = await params;
  const detail = getJobDetail(id);
  if (!detail) notFound();

  const repost = getRepost(id);
  const churchJobs = getChurchOtherJobs(detail.church.id, id);
  const similar = getSimilarJobs(id);

  return (
    <>
      {/* schema.org JobPosting JSON-LD (SEO) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd(detail)) }}
      />
      <RecordRecentlyViewed id={detail.job.id} title={detail.job.title} />
      <JobDetailView detail={detail} repost={repost} churchJobs={churchJobs} similar={similar} />
    </>
  );
}

function JobDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
