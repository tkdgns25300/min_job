import Link from "next/link";
import { ChurchChannels } from "@/components/church/church-channels";
import { ChurchGallery } from "@/components/church/church-gallery";
import { churchLocation, churchMetaLine, formatStipend, jobRoleLine } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, POSITIONS } from "@/constants/domain";
import type { Church, JobCard as JobCardData } from "@/types/domain";
import { REPOST_MIN_COUNT, type RoleHistory } from "@/lib/repost-tracking";

const externalAttrs = { target: "_blank", rel: "noopener noreferrer" } as const;

// 자리 이름: 부서 + 직분 (예: "유초등부 전도사")
function roleLabel(role: Pick<RoleHistory, "position" | "department">): string {
  return [role.department ? DEPARTMENTS[role.department] : null, POSITIONS[role.position]]
    .filter(Boolean)
    .join(" ");
}

// 현재 모집 카드 — 교회 상세 컨텍스트(교회명 반복 없음). 재공고면 배지.
function OpenJobCard({ job, repostCount }: { job: JobCardData; repostCount: number }) {
  const hasStipend = job.stipendMin !== null || job.stipendMax !== null;
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start gap-2">
        <h3 className="flex-1 leading-snug font-bold break-keep">{job.title}</h3>
        {repostCount >= REPOST_MIN_COUNT && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
            재공고 {repostCount}회
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{jobRoleLine(job)}</p>
      <p
        className={cn(
          "mt-auto pt-1 font-bold",
          hasStipend ? "text-primary" : "text-muted-foreground",
        )}
      >
        {formatStipend(job.stipendMin, job.stipendMax, job.stipendNote)}
      </p>
    </Link>
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
  const location = churchLocation(church);
  const mapUrl = `https://map.naver.com/p/search/${encodeURIComponent(`${church.name} ${location}`)}`;

  // 자리별 총 공고 수(재공고 배지용) — position+department로 매칭
  const repostCountFor = (job: JobCardData) =>
    timeline.find((r) => r.position === job.position && r.department === job.department)?.postings
      .length ?? 1;

  // 지난 공고(마감) — 자리 라벨 붙여 최신순
  const pastPostings = timeline
    .flatMap((r) =>
      r.postings.filter((p) => p.status === "CLOSED").map((p) => ({ ...p, role: roleLabel(r) })),
    )
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 pt-6 pb-24">
      {/* 커버 헤더 — 사진 있으면 갤러리(라이트박스), 없으면 딥그린 기본 */}
      <div>
        {church.photos && church.photos.length > 0 ? (
          <ChurchGallery photos={church.photos} name={church.name} meta={meta} />
        ) : (
          <div className="relative overflow-hidden rounded-2xl">
            {/* TODO: 기본 커버 이미지 제작 시 교체 (지금은 딥그린 그라데이션) */}
            <div className="bg-hero h-56 w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <Link
              href="/jobs"
              className="absolute top-4 left-4 text-sm text-white/85 transition-colors hover:text-white"
            >
              ← 목록으로
            </Link>
            <div className="absolute inset-x-0 bottom-0 p-6">
              <h1 className="text-2xl leading-snug font-bold break-keep text-white">
                {church.name}
              </h1>
              <p className="mt-1 text-sm text-white/85">{meta}</p>
            </div>
          </div>
        )}
        {church.links.length > 0 && (
          <div className="mt-4">
            <ChurchChannels links={church.links} variant="brand" />
          </div>
        )}
      </div>

      {/* 청빙 공고 — 방문 의도(공고)라 최상단. 현재 모집 + 지난 공고 접이식 (통합) */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">
          청빙 공고 <span className="text-primary">모집 중 {openJobs.length}</span>
        </h2>
        {openJobs.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {openJobs.map((job) => (
              <OpenJobCard key={job.id} job={job} repostCount={repostCountFor(job)} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            현재 모집 중인 공고가 없어요.
          </p>
        )}

        {pastPostings.length > 0 && (
          <details className="mt-1">
            <summary className="inline-block cursor-pointer text-sm font-semibold text-primary underline underline-offset-4 [&::-webkit-details-marker]:hidden">
              지난 공고 {pastPostings.length}건 보기
            </summary>
            <ul className="mt-3 divide-y divide-border border-t">
              {pastPostings.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/jobs/${p.id}`}
                    className="flex items-center gap-3 py-2.5 text-sm hover:text-foreground"
                  >
                    <span className="min-w-0 flex-1 truncate">{p.role}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {p.postedAt} ~ {p.deadline ?? "상시"}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                      마감
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* 위치 — 공고 아래 supporting info */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">위치</h2>
        <p className="text-sm">{location}</p>
        {/* 지도 자리(placeholder) — 클릭 시 네이버 지도. 임베드는 Phase 2(주소 필드+API 키) */}
        <a
          href={mapUrl}
          {...externalAttrs}
          className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-xl border bg-muted/40 text-center transition-colors hover:bg-muted/60"
        >
          <span className="text-sm font-medium text-foreground">지도에서 위치 보기</span>
          <span className="text-xs text-muted-foreground">네이버 지도에서 열기</span>
        </a>
      </section>
    </div>
  );
}
