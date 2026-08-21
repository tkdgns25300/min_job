import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { JobActions } from "@/components/job/job-actions";
import { JobCard } from "@/components/job/job-card";
import { ChurchChannels } from "@/components/church/church-channels";
import {
  churchMetaLine,
  churchPlaceLine,
  naverMapUrl,
  formatPay,
  jobRoleLine,
  payLabel,
  positionLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { APPLY_METHODS, EMPLOYMENT_TYPES, JOB_SOURCES, type JobSource } from "@/constants/domain";
import type { Church, Job, JobCard as JobCardData, JobChurchRef, JobDetail } from "@/types/domain";

const externalLinkAttrs = { target: "_blank", rel: "noopener noreferrer" } as const;

interface SourceLink {
  url: string;
  label: string;
}

/**
 * 확인용 출처 링크 — 원문(수집 공고) 우선, 없으면 교회 홈페이지.
 *
 * **지원 동선이 아니다.** 지원은 `ApplyMethods`가 보여주는 연락처로 한다. 이 링크의 일은 두 가지다:
 * 우리가 원문에서 뽑은 값이 틀렸을 때 원본을 확인시키는 것, 그리고 수집 공고의 출처 표기
 * (가드레일 #1의 "요약 + 출처 링크")를 지키는 것.
 *
 * 만료 공고에도 남긴다 — 그때는 사실확인이 유일한 용도다.
 */
function getSourceLink(
  job: Job,
  church: Church | null,
  isPubliclyOpen: boolean,
): SourceLink | null {
  if (job.sourceUrl) return { url: job.sourceUrl, label: "원문 공고 보기" };
  // 미claim 공고는 교회 채널을 모른다 — 수집 공고라 위의 원문 링크가 동선을 맡는다
  const homepage = church?.links.find((l) => l.type === "HOMEPAGE")?.url ?? null;
  if (isPubliclyOpen && homepage) {
    return { url: homepage, label: "교회 홈페이지 보기" };
  }
  return null;
}

// 본문 섹션 — 여백형(구분선 없이 여백으로만 구분). 첫 섹션은 상단 여백 없이
function Section({
  title,
  children,
  first,
}: {
  title: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <section className={first ? "" : "mt-9"}>
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

// 불릿 리스트 (자격요건·우대사항) — 아이콘 없이 대시(–). break-keep로 한글 단어 안 깨지게
function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm break-keep">
          <span className="shrink-0 text-muted-foreground">–</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// 요약 행 (라벨 좌 · 값 우)
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-semibold break-keep">{value}</dd>
    </div>
  );
}

// 상단 헤더 (풀폭) — 교회 정체성 + 제목
function PostHeader({ job, church }: { job: Job; church: JobChurchRef }) {
  const meta = churchMetaLine(church);
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">
            {/* 교회명은 공고의 정체성이라 항상 쓴다. 다만 미claim이면 걸 상세 페이지가 없다 */}
            {church.id ? (
              <Link href={`/churches/${church.id}`} className="font-semibold hover:underline">
                {church.name}
              </Link>
            ) : (
              <span className="font-semibold">{church.name}</span>
            )}
            {meta && <span className="text-muted-foreground"> · {meta}</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{job.postedAt} 등록</p>
        </div>
        <JobActions id={job.id} />
      </div>

      <div className="mt-5">
        <h1 className="text-2xl leading-snug font-bold break-keep">{job.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{jobRoleLine(job, { full: true })}</p>
      </div>
    </div>
  );
}

// 좌측 본문 — 사례비·마감·고용형태는 우측 카드, 나머지 조건·내용은 여기
function MainContent({
  job,
  church,
  churchRef,
  churchJobs,
}: {
  job: Job;
  church: Church | null;
  churchRef: JobChurchRef;
  churchJobs: JobCardData[];
}) {
  // 위치 표기·지도 검색 규칙은 lib/format이 단일 소스(교회 상세도 같은 함수를 쓴다)
  const location = churchPlaceLine(churchRef);
  const mapUrl = naverMapUrl(churchRef);

  return (
    <div>
      <Section title="모집 조건" first>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="text-xs text-muted-foreground">출근</dt>
            <dd className="mt-0.5 text-sm font-medium break-keep">{job.workDays ?? "협의"}</dd>
          </div>
          {/* null(정보 없음/협의)과 false(명시적 미제공)는 다르다 — DATA §3. null이면 줄을 뺀다 */}
          {job.housingProvided !== null && (
            <div>
              <dt className="text-xs text-muted-foreground">사택</dt>
              <dd className="mt-0.5 text-sm font-medium">
                {job.housingProvided ? "제공" : "미제공"}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">제출 서류</dt>
            <dd className="mt-0.5 text-sm font-medium break-keep">
              {job.requiredDocs.length > 0 ? job.requiredDocs.join(" · ") : "—"}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="자격 요건">
        <BulletList items={job.requirements} />
      </Section>

      {job.preferred.length > 0 && (
        <Section title="우대 사항">
          <BulletList items={job.preferred} />
        </Section>
      )}

      {job.description && (
        <Section title="공고 안내">
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-foreground/90">
            {job.description}
          </p>
        </Section>
      )}

      {mapUrl && (
        <Section title="위치">
          <p className="mt-3 text-sm">{location}</p>
          {/* 지도 자리(플레이스홀더) — 클릭 시 네이버 지도. 실제 임베드는 Phase 2(API 키+주소 필드) */}
          <a
            href={mapUrl}
            {...externalLinkAttrs}
            className="mt-3 flex h-40 flex-col items-center justify-center gap-1.5 rounded-xl border bg-muted/40 text-center transition-colors hover:bg-muted/60"
          >
            <span className="text-sm font-medium text-foreground">지도에서 위치 보기</span>
            <span className="text-xs text-muted-foreground">네이버 지도에서 열기</span>
          </a>
        </Section>
      )}

      {/* 교회 프로필 — 미claim 공고는 `churches` 행 자체가 없어 설립연도·채널·상세가 전부 없다.
          빈 껍데기를 그리거나 내부 데이터 사정을 설명하는 대신 섹션을 통째로 생략한다. */}
      {church && (
        // 제목도 churchRef를 쓴다 — 여기만 `church.name`을 읽으면 헤더와 이름이 갈릴 수 있다
        <Section title={churchRef.name}>
          {/* 교단·지역이 전부 미상이면 churchMetaLine이 ""라 점이 앞에 매달린다 */}
          <p className="mt-1 text-sm text-muted-foreground">
            {[churchMetaLine(churchRef), church.foundedYear && `${church.foundedYear}년 설립`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <Link
            href={`/churches/${church.id}`}
            className="mt-2 inline-block text-sm font-semibold text-primary underline underline-offset-4"
          >
            교회 상세 보기 →
          </Link>
          {church.links.length > 0 && (
            <div className="mt-4">
              <ChurchChannels links={church.links} />
            </div>
          )}
          {churchJobs.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-bold text-muted-foreground">이 교회의 다른 모집</p>
              <ul className="mt-2 divide-y divide-border">
                {churchJobs.map((cj) => {
                  const hasPay = cj.payMin !== null || cj.payMax !== null;
                  return (
                    <li key={cj.id}>
                      <Link
                        href={`/jobs/${cj.id}`}
                        className="group flex items-baseline justify-between gap-3 py-2.5 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate group-hover:underline">
                          {cj.title}
                          <span className="text-muted-foreground">
                            {" "}
                            · {positionLabel(cj.position)}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-semibold",
                            hasPay ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {formatPay(cj)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

/**
 * 지원 방법 — 공고가 공개한 연락처를 **전부** 보여준다. 순서는 `APPLY_METHODS` 정의 순서
 * (링크 > 이메일 > 우편 > 전화 — 앞셋은 서류를 내는 경로, 전화는 대개 문의용).
 *
 * **클릭 대상으로 만들지 않는다** — `mailto:`·`tel:`은 기기 설정에 따라 아무 일도 일어나지 않거나
 * 엉뚱한 앱이 열리고, 우편 주소는 애초에 열 것이 없다. 값을 읽고 직접 쓰는 편이 어긋남이 없다.
 *
 * ⚠️ 가드레일 #3 — 여기 있는 값은 공고가 **지원용으로 명시 공개**한 것뿐이다(`jobs.contact_*`).
 *    `churches.contact_*`(사무용, 인증 검수 대조용)는 **공개 화면에 렌더하지 않는다**(DATA §3).
 */
function ApplyMethods({ job }: { job: Job }) {
  const contacts = [
    { key: "LINK", value: job.contactLink },
    { key: "EMAIL", value: job.contactEmail },
    { key: "POST", value: job.contactPost },
    { key: "TEL", value: job.contactTel },
  ] as const;
  const shown = contacts.filter((c) => c.value);
  // CHECK ②가 최소 1개를 강제하지만 타입상으론 전부 null일 수 있다
  if (shown.length === 0) return null;

  return (
    <dl className="space-y-2.5">
      {shown.map(({ key, value }) => (
        <div key={key}>
          <dt className="text-xs text-muted-foreground">{APPLY_METHODS[key]}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// 우측 카드 (B) — 사례비·마감·고용형태 + 지원. 데스크톱 sticky, 모바일 제목 아래.
function SummaryAside({
  job,
  sourceLink,
  isPubliclyOpen,
}: {
  job: Job;
  sourceLink: SourceLink | null;
  isPubliclyOpen: boolean;
}) {
  const hasPay = job.payMin !== null || job.payMax !== null;

  return (
    <Card className="order-first gap-0 overflow-hidden p-0 lg:sticky lg:top-20 lg:order-none">
      <div className="p-5">
        {/* 만료 공고엔 연락처를 내리고 원문 링크만 남긴다 — 바로 위 마감 배너와 모순되고,
            지원해도 받아주지 않는 곳으로 헛걸음을 시킨다. */}
        {isPubliclyOpen && <ApplyMethods job={job} />}
        {/* 보조 링크 — 라벨과 대상 판단은 `getSourceLink`가 든다 */}
        {sourceLink && (
          <a
            href={sourceLink.url}
            {...externalLinkAttrs}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full",
              isPubliclyOpen && "mt-4",
            )}
          >
            {sourceLink.label}
          </a>
        )}
        <p className={cn("text-xs leading-relaxed text-muted-foreground", sourceLink && "mt-3")}>
          {isPubliclyOpen
            ? "민잡은 지원서를 직접 받지 않아요. 지원은 교회로 직접 해주세요."
            : "모집이 끝난 공고예요. 내용 확인용으로만 남겨둡니다."}
        </p>
      </div>
      <dl className="space-y-3 border-t p-5">
        <InfoRow
          label={payLabel(job.jobKind)}
          value={
            hasPay ? (
              <span className="text-primary">{formatPay(job)}</span>
            ) : (
              (job.payNote ?? "협의")
            )
          }
        />
        <InfoRow label="마감일" value={job.deadline ?? "상시모집"} />
        <InfoRow
          label="고용 형태"
          value={job.employmentType ? EMPLOYMENT_TYPES[job.employmentType] : "정보 없음"}
        />
      </dl>
    </Card>
  );
}

// 비슷한 공고 (하단)
function SimilarJobsSection({ jobs, moreHref }: { jobs: JobCardData[]; moreHref: string }) {
  return (
    <section id="similar-jobs" className="scroll-mt-20 space-y-3">
      <h2 className="text-base font-bold">비슷한 공고</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((sj) => (
          <JobCard key={sj.id} job={sj} />
        ))}
      </div>
      <Link
        href={moreHref}
        className="inline-block text-sm font-semibold text-primary underline underline-offset-4"
      >
        비슷한 공고 더 보기 →
      </Link>
    </section>
  );
}

// 마감 배너 — 무채색. 페이지는 살려둔다(롱테일 SEO).
// 공개에서 내려간 이유별 문구 — "마감"으로 뭉뚱그리지 않는다.
// 상시모집 90일 초과는 **교회가 마감한 적이 없다**(우리는 실제 마감 여부를 모른다 — DATA §6-1).
function closedHeadline(job: Job): string {
  if (job.status === "CLOSED") return "이 공고는 마감됐어요.";
  return job.deadline ? "모집 기간이 지났어요." : "게시한 지 오래돼 목록에서 내렸어요.";
}

function ClosedBanner({ job, hasSimilar }: { job: Job; hasSimilar: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">{closedHeadline(job)}</span>
      <span>공고 내용은 이력 확인을 위해 남겨 둡니다.</span>
      {hasSimilar && (
        <a href="#similar-jobs" className="font-medium text-primary hover:underline">
          비슷한 공고 보기
        </a>
      )}
    </div>
  );
}

// 하단 — 출처·오류 문의
function SourceNote({ source }: { source: JobSource }) {
  return (
    <p className="px-1 text-xs text-muted-foreground">
      {JOB_SOURCES[source]} 공고예요. 잘못된 정보가 있으면 문의해 주세요.
    </p>
  );
}

export function JobDetailView({
  detail,
  churchJobs,
  similar,
}: {
  detail: JobDetail;
  churchJobs: JobCardData[];
  similar: JobCardData[];
}) {
  const { job, church, churchRef } = detail;
  const sourceLink = getSourceLink(job, church, detail.isPubliclyOpen);
  // "더 보기" — 넓은 탐색은 /jobs로 (부서 우선, 없으면 직분으로 미리 필터).
  // ⚠️ 직분은 배열이라 **반복 파라미터**로 넘긴다(`?position=A&position=B`) — jobs-url-state가
  // `searchParams.getAll(dim)`으로 읽으므로 콤마로 이으면 "A,B" 한 값이 되어 아무것도 안 걸린다.
  const moreParams = job.department
    ? [`department=${job.department}`]
    : job.position.map((p) => `position=${p}`);
  const moreHref = moreParams.length > 0 ? `/jobs?${moreParams.join("&")}` : "/jobs";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <Link
        href="/jobs"
        className="inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← 목록으로
      </Link>

      {job.status !== "PENDING" && !detail.isPubliclyOpen && (
        <ClosedBanner job={job} hasSimilar={similar.length > 0} />
      )}

      <PostHeader job={job} church={churchRef} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <MainContent job={job} church={church} churchRef={churchRef} churchJobs={churchJobs} />
        <SummaryAside job={job} sourceLink={sourceLink} isPubliclyOpen={detail.isPubliclyOpen} />
      </div>

      {similar.length > 0 && <SimilarJobsSection jobs={similar} moreHref={moreHref} />}
      <SourceNote source={job.source} />
    </div>
  );
}
