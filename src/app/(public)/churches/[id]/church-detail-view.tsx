import Link from "next/link";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { JobCard } from "@/components/job/job-card";
import { ChurchChannels } from "@/components/church/church-channels";
import { churchMetaLine } from "@/lib/format";
import { POSITIONS, DEPARTMENTS } from "@/constants/domain";
import type { Church, JobCard as JobCardData } from "@/types/domain";
import { REPOST_MIN_COUNT, type RoleHistory } from "@/lib/repost-tracking";

// 자리 이름: 부서 + 직분 (예: "유초등부 전도사", "강도사")
function roleLabel(role: RoleHistory): string {
  return [role.department ? DEPARTMENTS[role.department] : null, POSITIONS[role.position]]
    .filter(Boolean)
    .join(" ");
}

// 이력에 노출할 자리: 현재 단발 공고(위 카드에 이미 있음)는 제외 — 반복됐거나 지난 공고가 있는 것만
function toHistoryRoles(timeline: RoleHistory[]): RoleHistory[] {
  return timeline.filter(
    (role) => !(role.postings.length === 1 && role.postings[0].status === "OPEN"),
  );
}

function PostingRow({ posting }: { posting: RoleHistory["postings"][number] }) {
  return (
    <Link
      href={`/jobs/${posting.id}`}
      className="flex items-center gap-3 py-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <span className="tabular-nums">
        {posting.postedAt} ~ {posting.deadline ?? "상시"}
      </span>
      <Badge variant={posting.status === "OPEN" ? "default" : "secondary"} className="ml-auto">
        {posting.status === "OPEN" ? "모집중" : "마감"}
      </Badge>
    </Link>
  );
}

// 공고 이력 — 요약 문장(재공고 시) + <details> 토글 상세 (시안 C). JS 없이 <details>로.
function HistorySection({ timeline }: { timeline: RoleHistory[] }) {
  const roles = toHistoryRoles(timeline);
  if (roles.length === 0) return null;

  const topRepost = roles.find((role) => role.postings.length >= REPOST_MIN_COUNT);

  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold">공고 이력</h2>
      {topRepost && (
        <p className="flex items-center gap-1.5 text-sm">
          <RefreshCw className="size-4 shrink-0 text-muted-foreground" />이 교회는{" "}
          <b>{roleLabel(topRepost)}</b> 자리를 최근 <b>{topRepost.postings.length}번</b> 공고했어요.
        </p>
      )}
      <details className="group rounded-lg border">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
          {topRepost ? "공고 이력 자세히" : "지난 공고 보기"}
          <ChevronRight className="ml-auto size-4 transition-transform group-open:rotate-90" />
        </summary>
        <div className="space-y-4 px-4 pb-4">
          {roles.map((role, i) => (
            <div
              key={`${role.position}-${role.department ?? "none"}`}
              className={i > 0 ? "border-t pt-4" : ""}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{roleLabel(role)}</span>
                {role.postings.length >= REPOST_MIN_COUNT && (
                  <Badge variant="secondary" className="gap-1">
                    <RefreshCw className="size-3" /> 재공고 {role.postings.length}회
                  </Badge>
                )}
              </div>
              <ul className="mt-2 space-y-1">
                {role.postings.map((posting) => (
                  <li key={posting.id}>
                    <PostingRow posting={posting} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

export function ChurchDetailView({
  church,
  openJobs,
  timeline,
}: {
  church: Church;
  openJobs: JobCardData[];
  timeline: RoleHistory[];
}) {
  const meta = church.foundedYear
    ? `${churchMetaLine(church)} · ${church.foundedYear}년 설립`
    : churchMetaLine(church);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> 공고 목록
      </Link>

      {/* 헤더 — 교회 정체성 + 채널 */}
      <header className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground">
            {church.name.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl leading-snug font-bold">{church.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
          </div>
        </div>
        {church.links.length > 0 && <ChurchChannels links={church.links} />}
      </header>

      {/* 현재 모집 공고 */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">
          현재 모집 <span className="text-primary">{openJobs.length}</span>건
        </h2>
        {openJobs.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {openJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            현재 모집 중인 공고가 없어요.
          </p>
        )}
      </section>

      {/* 공고 이력 — 자리별 재공고 패턴 (차별점, 접이식) */}
      <HistorySection timeline={timeline} />
    </div>
  );
}
