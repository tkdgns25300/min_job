import Link from "next/link";
import { MapPin } from "lucide-react";
import type { JobCard } from "@/types/domain";
import { churchLocation, denominationLabel, formatPayShort, jobRoleLine } from "@/lib/format";
import { RelativeTime } from "@/components/relative-time";
import { BookmarkButton } from "./bookmark-button";
import { cn } from "@/lib/utils";

// 대표광고(HERO) 전용 카드 — 홈 "추천 청빙" 슬롯. 리스트 로우보다 크고 초록 테두리로 도드라지게.
export function FeaturedJobCard({ job }: { job: JobCard }) {
  const role = jobRoleLine(job);
  const denomination = denominationLabel(job.church.denomination);
  const location = churchLocation(job.church);
  const hasPay = job.payMin !== null || job.payMax !== null;

  return (
    <article className="relative flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-primary/30 bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/jobs/${job.id}`} className="absolute inset-0" aria-label={job.title} />

      <div className="flex items-center justify-between">
        <span className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
          대표광고
        </span>
        <BookmarkButton jobId={job.id} className="-mt-1 -mr-1" />
      </div>

      <h3 className="text-[17px] leading-snug font-extrabold tracking-tight">{job.title}</h3>

      {/* 조각 단위 줄바꿈 — `job-row`의 메타 줄과 같은 규칙(그 파일 주석 참조) */}
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
        {location && (
          <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-foreground">
            <MapPin className="size-3.5 shrink-0 text-primary" />
            {location}
          </span>
        )}
        <span className="max-w-full truncate">
          {location && <span className="mr-1.5 text-border">·</span>}
          {job.church.name}
        </span>
        {denomination && (
          <span className="whitespace-nowrap">
            <span className="mr-1.5 text-border">·</span>
            {denomination}
          </span>
        )}
      </p>
      <p className="truncate text-sm text-muted-foreground">{role}</p>

      <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
        <span
          className={cn(
            hasPay ? "font-bold text-primary" : "text-sm font-semibold text-muted-foreground",
          )}
        >
          {formatPayShort(job)}
        </span>
        <span className="text-xs text-muted-foreground/80">
          <RelativeTime date={job.postedAt} />
        </span>
      </div>
    </article>
  );
}
