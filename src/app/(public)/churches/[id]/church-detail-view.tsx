import Link from "next/link";
import { FRESH_POST_DAYS } from "@/constants/domain";
import { JobBadges } from "@/components/job/job-badges";
import { RelativeTime } from "@/components/relative-time";
import { ChurchChannels } from "@/components/church/church-channels";
import {
  churchMetaLine,
  churchPlaceLine,
  formatPayShort,
  jobRoleLine,
  naverMapUrl,
  publicPositionLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/constants/domain";
import type { Church, JobCard as JobCardData, PastJob } from "@/types/domain";

const externalAttrs = { target: "_blank", rel: "noopener noreferrer" } as const;

// 자리 이름: 부서 + 직분/직무 (예: "유초등부 전도사"·"행정 행정간사")
// 일반직은 직분이 비어 `role`이 그 자리를 채운다 — 안 넣으면 빈 줄이 된다. "기타"뿐인 직분도 빈 것으로 본다.
function roleLabel(role: Pick<PastJob, "position" | "role" | "department">): string {
  return [
    role.department ? DEPARTMENTS[role.department] : null,
    publicPositionLabel(role.position, { full: true }) || role.role,
  ]
    .filter(Boolean)
    .join(" ");
}

// 현재 모집 카드 — 교회 상세 컨텍스트(교회명 반복 없음)
function OpenJobCard({ job }: { job: JobCardData }) {
  const hasPay = job.payMin !== null || job.payMax !== null;
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
    >
      <h3 className="leading-snug font-bold break-keep">{job.title}</h3>
      <p className="text-sm text-muted-foreground">{jobRoleLine(job)}</p>
      {/* 교회명·지역은 없다(페이지가 그 교회) — 자리 사이의 차이(마감 임박·사택)가 전부라 배지가 더 크게 일한다 */}
      <JobBadges job={job} />
      <div className="mt-auto flex items-center justify-between pt-1">
        <span className={cn("font-bold", hasPay ? "text-primary" : "text-muted-foreground")}>
          {formatPayShort(job)}
        </span>
        <span className="text-xs text-muted-foreground/80">
          <RelativeTime date={job.postedAt} highlightWithinDays={FRESH_POST_DAYS} />
        </span>
      </div>
    </Link>
  );
}

export function ChurchDetailView({
  church,
  openJobs,
  pastJobs,
}: {
  church: Church;
  openJobs: JobCardData[];
  pastJobs: PastJob[];
}) {
  // 교단·지역이 전부 미상이면 churchMetaLine이 ""라 " · 1985년 설립"처럼 점이 앞에 매달린다
  const meta = [churchMetaLine(church), church.foundedYear && `${church.foundedYear}년 설립`]
    .filter(Boolean)
    .join(" · ");
  // 위치 표기·지도 검색 규칙은 lib/format이 단일 소스(공고 상세도 같은 함수를 쓴다)
  const location = churchPlaceLine(church);
  const mapUrl = naverMapUrl(church);

  // 지난 공고(마감) — 자리 라벨을 붙여 표시
  const pastPostings = pastJobs.map((p) => ({ ...p, role: roleLabel(p) }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 pt-6 pb-24">
      {/* 커버 헤더 — 딥그린 기본 커버.
          ⛔ 사진 갤러리(라이트박스)는 뺐다(2026-08-29 · MVP 범위 밖). 업로드 경로가 없어 데이터가 영원히
             0장인데 클라이언트 청크는 방문자 전원에게 실려 나갔다. 되살릴 때는 `e586fe0`의
             `components/church/church-gallery.tsx`를 참조(첫 장=커버 · 썸네일 스트립 · 라이트박스). */}
      <div>
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
            <h1 className="text-2xl leading-snug font-bold break-keep text-white">{church.name}</h1>
            <p className="mt-1 text-sm text-white/85">{meta}</p>
          </div>
        </div>
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
              <OpenJobCard key={job.id} job={job} />
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
      {mapUrl && (
        <section className="space-y-3">
          <h2 className="text-base font-bold">위치</h2>
          {/* 지도는 주소 옆 링크 한 개 — 공고 상세와 같은 모양(플레이스홀더 상자는 2026-08-30에 뺐다).
              임베드는 Phase 2(주소 필드+API 키) */}
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span>{location}</span>
            <a
              href={mapUrl}
              {...externalAttrs}
              className="font-semibold text-primary underline underline-offset-4"
            >
              지도에서 보기
            </a>
          </p>
        </section>
      )}
    </div>
  );
}
