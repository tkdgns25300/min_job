import Link from "next/link";
import { MapPin } from "lucide-react";
import type { JobCard } from "@/types/domain";
import { churchLocation, denominationLabel, formatPay, jobRoleLine } from "@/lib/format";
import { RelativeTime } from "@/components/relative-time";
import { BookmarkButton } from "./bookmark-button";

// 홈·목록 리스트 로우 — 제목이 주인공, 직분·부서·지역은 평문.
// 유료 노출(대표광고·프리미엄)은 organic처럼 보이되 작은 "광고" 태그로만 표시(표시광고·신뢰).
//   티어 차이는 노출 위치(대표광고=최상단, 프리미엄=상단)로만 — 배경 틴트·요란한 라벨 없음.
// 전체 행 클릭 = 상세로(stretched Link), 책갈피만 별도 클릭(z-10).
export function JobRow({ job }: { job: JobCard }) {
  const role = jobRoleLine(job);
  const denomination = denominationLabel(job.church.denomination);
  const location = churchLocation(job.church);
  const isAd = job.featuredTier === "HERO" || job.featuredTier === "PREMIUM";
  const hasPay = job.payMin !== null || job.payMax !== null;

  return (
    <article className="relative flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5">
      <Link href={`/jobs/${job.id}`} className="absolute inset-0" aria-label={job.title} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-bold tracking-tight">{job.title}</h3>
          {isAd && (
            <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              광고
            </span>
          )}
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          {location && (
            <>
              <MapPin className="size-3.5 shrink-0 text-primary" />
              <span className="font-medium text-foreground">{location}</span>
              <span className="text-border">·</span>
            </>
          )}
          {job.church.name}
          {denomination && (
            <>
              <span className="text-border">·</span>
              {denomination}
            </>
          )}
        </p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{role}</p>
      </div>

      <div className="shrink-0 text-right">
        {hasPay ? (
          <div className="font-bold text-primary">
            {formatPay(job.payMin, job.payMax, job.payNote)}
          </div>
        ) : (
          <div className="text-sm font-semibold text-muted-foreground">
            {formatPay(job.payMin, job.payMax, job.payNote)}
          </div>
        )}
        <div className="mt-1.5 text-xs text-muted-foreground/80">
          <RelativeTime date={job.postedAt} />
        </div>
      </div>

      <BookmarkButton jobId={job.id} className="-mr-1" />
    </article>
  );
}
