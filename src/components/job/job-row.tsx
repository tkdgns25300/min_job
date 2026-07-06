import Link from "next/link";
import { MapPin } from "lucide-react";
import { DENOMINATIONS } from "@/constants/domain";
import type { JobCard } from "@/types/domain";
import { churchLocation, formatStipend, jobRoleLine } from "@/lib/format";
import { RelativeTime } from "@/components/relative-time";
import { BookmarkButton } from "./bookmark-button";
import { cn } from "@/lib/utils";

// 홈·목록 리스트 로우 — 제목이 주인공, 직분·부서·지역은 평문, 노출 뱃지만 배지.
// 전체 행 클릭 = 상세로(stretched Link), 책갈피만 별도 클릭(z-10).
export function JobRow({ job }: { job: JobCard }) {
  const role = jobRoleLine(job);
  const location = churchLocation(job.church);
  const isAd = job.featuredTier === "HERO";
  const isPremium = job.featuredTier === "PREMIUM";
  const hasStipend = job.stipendMin !== null || job.stipendMax !== null;

  return (
    <article
      className={cn(
        "relative flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5",
        (isAd || isPremium) && "bg-primary/[0.04]",
      )}
    >
      <Link href={`/jobs/${job.id}`} className="absolute inset-0" aria-label={job.title} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-bold tracking-tight">{job.title}</h3>
          {isAd && (
            <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
              대표광고
            </span>
          )}
          {isPremium && (
            <span className="shrink-0 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
              프리미엄
            </span>
          )}
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0 text-primary" />
          <span className="font-medium text-foreground">{location}</span>
          <span className="text-border">·</span>
          {job.church.name}
          <span className="text-border">·</span>
          {DENOMINATIONS[job.church.denomination]}
        </p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{role}</p>
      </div>

      <div className="shrink-0 text-right">
        {hasStipend ? (
          <div className="font-bold text-primary">
            {formatStipend(job.stipendMin, job.stipendMax, job.stipendNote)}
          </div>
        ) : (
          <div className="text-sm font-semibold text-muted-foreground">
            {formatStipend(job.stipendMin, job.stipendMax, job.stipendNote)}
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
