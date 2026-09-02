import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { JobDetailView } from "./job-detail-view";
import { RecordRecentlyViewed } from "@/components/job/record-recently-viewed";
import { getChurchOpenJobs, getJobDetail, getSimilarJobs } from "@/lib/queries/jobs";
import { breadcrumbJsonLd, jobPostingJsonLd, jobRoleSummary } from "@/lib/seo";
import { churchLocation, formatPay } from "@/lib/format";
import { REGIONS } from "@/constants/domain";
import { SITE_OPEN_GRAPH } from "@/constants/site";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const detail = await getJobDetail(id);
  if (!detail) return { title: "공고를 찾을 수 없습니다 | 민잡" };

  // `||` — DB는 NOT NULL이지만 빈 문자열이 가능하다(`lib/seo.ts` 같은 이유)
  const description = detail.job.description || jobRoleSummary(detail);
  return {
    title: `${detail.job.title} | 민잡`,
    description,
    openGraph: { ...SITE_OPEN_GRAPH, title: detail.job.title, description, type: "article" },
    // 공유 링크에 붙는 추적 쿼리(?utm_source=…)가 별도 페이지로 색인되지 않게 대표 URL 고정
    alternates: { canonical: `/jobs/${id}` },
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
  const detail = await getJobDetail(id);
  if (!detail) notFound();
  const church = detail.churchRef;
  // 미claim 공고는 묶어줄 교회가 없다 — "이 교회 다른 모집" 조회 자체를 건너뛴다
  const churchJobs = church.id ? await getChurchOpenJobs(church.id, id) : [];
  const similar = await getSimilarJobs(id);
  // 지역 미상이면 `""`가 아니라 **undefined**를 넘긴다 — 소비처가 `location ?? subtitle`로 폴백하는데
  // `""`는 nullish가 아니라 폴백을 막고(교회명이 가려짐), `&&` 가드엔 falsy로 걸려 줄이 통째로 사라진다.
  const location = churchLocation(church) || undefined;

  return (
    <>
      {/* schema.org JobPosting JSON-LD (SEO) — 모집중일 때만.
          구글은 마감 공고의 구조화 데이터 제거를 권장한다. validThrough(마감일)만 믿으면
          "마감일 없이 조기 마감" 또는 "마감일이 미래인데 마감" 공고가 모집중으로 노출된다
          → 상태를 직접 본다. 페이지 자체는 계속 열린다(교회 진입 경로·롱테일 SEO). */}
      {/* BreadcrumbList JSON-LD — 검색 결과에 URL 대신 경로를 보여준다. 마감 공고도 유효 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([{ name: "청빙 공고", path: "/jobs" }, { name: detail.job.title }]),
          ),
        }}
      />
      {detail.isPubliclyOpen && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd(detail)) }}
        />
      )}
      <RecordRecentlyViewed
        id={detail.job.id}
        title={detail.job.title}
        subtitle={[church.name, church.region ? REGIONS[church.region] : null]
          .filter(Boolean)
          .join(" · ")}
        location={location}
        pay={
          detail.job.payMin !== null || detail.job.payMax !== null
            ? formatPay(detail.job)
            : undefined
        }
      />
      <JobDetailView detail={detail} churchJobs={churchJobs} similar={similar} />
    </>
  );
}

function JobDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
        {/* 우측 사이드바는 데스크톱 전용(경량 CTA 카드) — 스켈레톤도 동일하게 */}
        <div className="hidden h-56 animate-pulse rounded-xl bg-muted lg:block" />
      </div>
    </div>
  );
}
