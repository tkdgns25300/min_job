import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DENOMINATIONS, REGIONS, POSITIONS, DEPARTMENTS, EMPLOYMENT_TYPES } from "@/constants/domain";
import type { JobCard as JobCardData } from "@/types/domain";
import { formatStipend } from "@/lib/format";
import { cn } from "@/lib/utils";

export function JobCard({ job }: { job: JobCardData }) {
  const role = [
    POSITIONS[job.position],
    job.department ? DEPARTMENTS[job.department] : null,
    EMPLOYMENT_TYPES[job.employmentType],
  ]
    .filter(Boolean)
    .join(" · ");
  const location = `${REGIONS[job.church.region]}${job.church.city ? ` ${job.church.city}` : ""}`;
  const isAd = job.featuredTier === "HERO";
  const isPremium = job.featuredTier === "PREMIUM";

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
          <span className="font-bold">
            {formatStipend(job.stipendMin, job.stipendMax, job.stipendNote)}
          </span>
          <span className="text-xs text-muted-foreground">{job.postedAt}</span>
        </div>
      </Card>
    </Link>
  );
}
