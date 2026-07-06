import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Check, ExternalLink, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { JobActions } from "@/components/job/job-actions";
import { JobCard } from "@/components/job/job-card";
import { ChurchChannels } from "@/components/church/church-channels";
import { churchMetaLine, formatStipend, jobRoleLine } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EMPLOYMENT_TYPES, JOB_SOURCES, type JobSource } from "@/constants/domain";
import type { Church, Job, JobCard as JobCardData, JobDetail } from "@/types/domain";
import type { RepostInfo } from "@/lib/repost-tracking";

const externalLinkAttrs = { target: "_blank", rel: "noopener noreferrer" } as const;

// 본문 흐름 속 한 섹션 — 상단 구분선 + 제목 + 내용 (첫 섹션은 border 없이)
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 border-t pt-6">
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

// 체크 불릿 리스트 (자격요건·우대사항)
function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// 본문 상단 헤더 블록 (메인 카드 안, 카드 아님)
function PostHeader({
  job,
  church,
  repost,
}: {
  job: Job;
  church: Church;
  repost: RepostInfo | null;
}) {
  const roleLine = jobRoleLine(job);

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
          {church.name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <Link href={`/churches/${church.id}`} className="font-semibold hover:underline">
              {church.name}
            </Link>
            <span className="text-muted-foreground"> · {churchMetaLine(church)}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{job.postedAt} 등록</p>
        </div>
        <JobActions id={job.id} />
      </div>

      <div className="mt-5">
        {repost && (
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            <RefreshCw className="size-3" /> 재공고 {repost.count}회
          </span>
        )}
        <h1 className="text-2xl leading-snug font-bold">{job.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{roleLine}</p>
        {repost?.previousDeadline && (
          <p className="mt-1 text-xs text-muted-foreground">
            직전 공고는 {repost.previousDeadline} 마감됐어요.
          </p>
        )}
      </div>
    </div>
  );
}

// 좌측 본문 — 하나의 면에서 섹션들이 구분선으로 흐름
function MainContent({
  job,
  church,
  churchJobs,
  repost,
}: {
  job: Job;
  church: Church;
  churchJobs: JobCardData[];
  repost: RepostInfo | null;
}) {
  return (
    <div>
      <PostHeader job={job} church={church} repost={repost} />

      <Section title="자격 요건">
        <CheckList items={job.requirements} />
      </Section>

      {job.preferred.length > 0 && (
        <Section title="우대 사항">
          <CheckList items={job.preferred} />
        </Section>
      )}

      {job.description && (
        <Section title="공고 안내">
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-foreground/90">
            {job.description}
          </p>
        </Section>
      )}

      <Section title={church.name}>
        <p className="mt-1 text-sm text-muted-foreground">{churchMetaLine(church)}</p>
        <Link
          href={`/churches/${church.id}`}
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          교회 상세 보기 →
        </Link>
        {churchJobs.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-muted-foreground">이 교회의 다른 모집</p>
            <ul className="mt-2 space-y-1.5">
              {churchJobs.map((cj) => (
                <li key={cj.id}>
                  <Link
                    href={`/jobs/${cj.id}`}
                    className="line-clamp-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {cj.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </div>
  );
}

// 요약 사이드바 행
function SumRow({
  label,
  children,
  big,
  accent,
}: {
  label: string;
  children: ReactNode;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right font-semibold",
          big && "text-xl font-bold",
          accent && "text-primary",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

// 우측 요약 사이드바 (핵심 조건 + 지원 CTA + 교회 채널) — 데스크톱 sticky, 모바일 상단
function SummaryAside({ job, church }: { job: Job; church: Church }) {
  const homepage = church.links.find((l) => l.type === "HOMEPAGE")?.url ?? null;
  const applyUrl = job.sourceUrl ?? homepage;
  const applyLabel = job.sourceUrl ? "원문 공고 보기" : "교회 홈페이지에서 지원 안내 확인";
  const hasStipend = job.stipendMin !== null || job.stipendMax !== null;

  return (
    <Card className="order-first gap-4 p-5 lg:sticky lg:top-20 lg:order-none">
      <h2 className="sr-only">핵심 조건</h2>
      <dl className="space-y-3">
        <SumRow label="월 사례비" big accent={hasStipend}>
          {formatStipend(job.stipendMin, job.stipendMax, job.stipendNote)}
        </SumRow>
        <div className="border-t" />
        <SumRow label="마감일">{job.deadline ?? "상시모집"}</SumRow>
        <SumRow label="출근">{job.workDays ?? "협의"}</SumRow>
        <SumRow label="고용 형태">{EMPLOYMENT_TYPES[job.employmentType]}</SumRow>
        <SumRow label="제출 서류">
          {job.requiredDocs.length > 0 ? job.requiredDocs.join(" · ") : "—"}
        </SumRow>
      </dl>

      <div>
        {applyUrl && (
          <a
            href={applyUrl}
            {...externalLinkAttrs}
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            {applyLabel}
            <ExternalLink />
          </a>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          민잡은 직접 지원을 받지 않습니다. 지원 방법·서류 제출은 원문 공고와 교회 안내를 따라
          교회로 직접 문의해 주세요.
        </p>
      </div>

      {church.links.length > 0 && (
        <div className="border-t pt-4">
          <p className="text-xs font-bold text-muted-foreground">교회 채널</p>
          <div className="mt-2">
            <ChurchChannels links={church.links} />
          </div>
        </div>
      )}
    </Card>
  );
}

// 비슷한 공고 (JobCard 포함 → 2단 아래 별도 섹션)
function SimilarJobsSection({ jobs }: { jobs: JobCardData[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold">비슷한 공고</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((sj) => (
          <JobCard key={sj.id} job={sj} />
        ))}
      </div>
    </section>
  );
}

// 하단 — 출처·오류 문의
function SourceNote({ source }: { source: JobSource }) {
  return (
    <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
      <AlertTriangle className="size-3.5 shrink-0" />
      {JOB_SOURCES[source]} 공고예요. 잘못된 정보가 있으면 문의해 주세요.
    </p>
  );
}

export function JobDetailView({
  detail,
  repost,
  churchJobs,
  similar,
}: {
  detail: JobDetail;
  repost: RepostInfo | null;
  churchJobs: JobCardData[];
  similar: JobCardData[];
}) {
  const { job, church } = detail;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> 목록으로
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <MainContent job={job} church={church} churchJobs={churchJobs} repost={repost} />
        <SummaryAside job={job} church={church} />
      </div>

      {similar.length > 0 && <SimilarJobsSection jobs={similar} />}
      <SourceNote source={job.source} />
    </div>
  );
}
