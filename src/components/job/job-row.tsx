import Link from "next/link";
import { MapPin } from "lucide-react";
import type { JobCard } from "@/types/domain";
import { churchLocation, denominationLabel, formatPayShort, jobRoleLine } from "@/lib/format";
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
  const pay = formatPayShort(job);

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
        {/* 지역·교회·교단 — **조각 단위로 줄을 바꾼다**(`flex-wrap` + 조각마다 `whitespace-nowrap`). 한때 줄바꿈
            없는 flex라 390px에서 세 조각이 좁게 눌려 "상\n록구 · 안산드림교\n회"처럼 글자가 세로로 쌓였다
            (2026-08-30 전수 점검). 점은 뒤 조각에 붙여 줄 머리에 점만 남지 않게 한다. */}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
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
        <p className="mt-1 truncate text-sm text-muted-foreground">{role}</p>
      </div>

      {/* 사례비는 카드용 두 값(금액/협의)만 온다 — 자유 텍스트를 그대로 넣던 때는 174자짜리가 이 칸을
          밀어 제목이 세로로 무너졌다(2026-08-29). 원문은 상세 페이지에 */}
      <div className="shrink-0 text-right">
        {hasPay ? (
          <div className="font-bold text-primary">{pay}</div>
        ) : (
          <div className="text-sm font-semibold text-muted-foreground">{pay}</div>
        )}
        <div className="mt-1.5 text-xs text-muted-foreground/80">
          <RelativeTime date={job.postedAt} />
        </div>
      </div>

      <BookmarkButton jobId={job.id} className="-mr-1" />
    </article>
  );
}
