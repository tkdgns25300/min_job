import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DENOMINATIONS } from "@/constants/domain";
import type { JobCard as JobCardData } from "@/types/domain";
import { churchLocation, formatPay, jobRoleLine } from "@/lib/format";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";

export function JobCard({ job }: { job: JobCardData }) {
  const role = jobRoleLine(job);
  const location = churchLocation(job.church);
  const isAd = job.featuredTier === "HERO";
  const isPremium = job.featuredTier === "PREMIUM";
  const hasPay = job.payMin !== null || job.payMax !== null;

  return (
    <Link href={`/jobs/${job.id}`} className="group block h-full">
      <Card
        className={cn(
          "flex h-full flex-col gap-3 p-5 transition-colors group-hover:border-ring",
          isAd && "border-primary/30 bg-muted/30",
        )}
      >
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{job.church.name}</span>
          <span className="text-border">·</span>
          <span>{DENOMINATIONS[job.church.denomination]}</span>
          <span className="text-border">·</span>
          <span>{location}</span>
          {(isAd || isPremium) && (
            <Badge variant={isAd ? "default" : "secondary"} className="ml-auto shrink-0">
              {isAd ? "대표광고" : "프리미엄"}
            </Badge>
          )}
        </div>
        <h3 className="line-clamp-2 leading-snug font-semibold">{job.title}</h3>
        <p className="text-sm text-muted-foreground">{role}</p>
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className={cn("font-bold", hasPay ? "text-primary" : "text-muted-foreground")}>
            {formatPay(job.payMin, job.payMax, job.payNote)}
          </span>
          <span className="text-xs text-muted-foreground">
            <RelativeTime date={job.postedAt} />
          </span>
        </div>
      </Card>
    </Link>
  );
}
