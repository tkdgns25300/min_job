import Link from "next/link";
import { MapPin } from "lucide-react";
import type { JobCard as JobCardData } from "@/types/domain";
import { churchLocation, denominationLabel, formatPayShort, jobRoleLine } from "@/lib/format";
import { RelativeTime } from "@/components/relative-time";
import { BookmarkButton } from "./bookmark-button";
import { cn } from "@/lib/utils";

// 공고 카드 — 홈 "추천 청빙" 3칸과 공고 상세 "비슷한 공고" 6장이 **같은 카드**를 쓴다(2026-09-03 통합.
// 그전엔 홈용 대표광고 카드가 따로 있어 등급 배지·초록 테두리로 도드라졌다). 읽는 순서는 로우(`job-row`)와
// 같다: 제목 → 지역·교회·교단 → 자리 → 사례비·게시. 화면마다 정보 순서가 안 바뀌게.
//
// `ad`는 **공고가 아니라 자리의 속성**이다 — 그 칸이 유료 배치인가(`PlacedJob`). 공고의 `featuredTier`에서
// 파생하지 않는다: 같은 공고가 유기적으로 뜬 자리에는 라벨이 붙지 않아야 한다.
// 표시는 회색 텍스트 "광고" 한 단어뿐 — 등급명·틴트·색 테두리 없음(SPEC 수익화 절 · 표시광고·신뢰).
// 전체 카드 클릭 = 상세(stretched Link), 책갈피만 별도 클릭(z-10).
// `preview` = 아직 없는 공고(등록 폼·검수 미리보기) — 저장 버튼을 끈다. 버튼의 `useBookmarks`는 provider 밖
// (admin 셸)에서 던지고, 있는 곳에서도 없는 id를 저장하려 든다(`JobDetailView`의 `preview`와 같은 선례).
export function JobCard({
  job,
  ad = false,
  preview = false,
}: {
  job: JobCardData;
  ad?: boolean;
  preview?: boolean;
}) {
  const role = jobRoleLine(job);
  const denomination = denominationLabel(job.church.denomination);
  const location = churchLocation(job.church);
  const hasPay = job.payMin !== null || job.payMax !== null;

  return (
    <article className="relative flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors hover:border-ring">
      <Link
        href={`/jobs/${job.id}`}
        className="absolute inset-0 rounded-2xl"
        aria-label={job.title}
      />

      {/* 저장 버튼은 **제목 줄 오른쪽**에 — 그전엔 라벨 줄(광고 표시 자리)에 혼자 떠서, 광고가 아닌 카드에서는
          아이콘 하나가 한 줄을 통째로 차지했다(운영자 2026-09-05). "광고"도 그 옆에 같은 줄로 붙인다: 줄이 항상
          있어야 한 줄에 선 세 장의 제목 높이가 맞는다(광고일 때만 줄이 생기면 어긋난다). */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 leading-snug font-bold tracking-tight">{job.title}</h3>
        <div className="-mt-1 -mr-1.5 flex shrink-0 items-center gap-1">
          {ad && <span className="text-[11px] font-medium text-muted-foreground">광고</span>}
          {preview ? null : <BookmarkButton jobId={job.id} />}
        </div>
      </div>

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
      {role ? <p className="truncate text-sm text-muted-foreground">{role}</p> : null}

      <div className="mt-auto flex items-center justify-between border-t border-border pt-2.5">
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
