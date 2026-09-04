import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
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
  formatPayShort,
  housingDisplay,
  jobRoleLine,
  payLabel,
  publicPositionLabel,
} from "@/lib/format";
import { facetsOfJob } from "@/lib/job-facets";
import { normalizeExternalUrl } from "@/lib/external-url";
import { cn } from "@/lib/utils";
import { APPLY_METHODS, EMPLOYMENT_TYPES } from "@/constants/domain";
import type {
  Church,
  Job,
  JobCard as JobCardData,
  JobChurchRef,
  JobDetail,
  PlacedJob,
} from "@/types/domain";

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

// 불릿 리스트 (자격요건·우대사항·제출 서류) — 아이콘 없이 대시(–). break-keep로 한글 단어 안 깨지게.
// `className`은 간격·글자 크기를 자리에 맞출 때만(모집 조건 줄 안에서는 더 촘촘하고 작다)
function BulletList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("mt-3 space-y-2 text-sm", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-2 break-keep">
          <span className="shrink-0 text-muted-foreground">–</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * 제출 서류 — 항목마다 한 줄(자격 요건과 같은 대시 목록). 다섯 목록 컬럼 중 이 칸만 " · "로 이어 한 줄이었는데,
 * 항목 3개 중 1개가 괄호·콜론을 품은 문장이라(실측 2026-08-30 · 3,116개 중 1,013개) 구분점이 묻히고
 * 4건 중 1건이 두 줄로 넘쳤다. 배열을 해석하지 않고 그대로 나열만 한다 — 저장 단위 = 교회가 입력한 단위 = 표시 단위.
 * 선택 서류는 필수와 무게가 달라야 한다 — 같은 굵기면 다 내야 하는 것으로 읽힌다.
 */
function DocList({ required, optional }: { required: string[]; optional: string[] }) {
  return (
    <>
      {required.length > 0 ? <BulletList items={required} className="mt-1 space-y-1" /> : "—"}
      {optional.length > 0 && (
        <div className="mt-2 text-xs font-normal text-muted-foreground">
          선택
          <BulletList items={optional} className="mt-1 space-y-1 text-xs" />
        </div>
      )}
    </>
  );
}

// 순서가 뜻을 갖는 목록(전형 절차) — 대시 불릿과 달리 번호를 붙인다
function StepList({ items }: { items: string[] }) {
  return (
    <ol className="mt-3 space-y-2">
      {items.map((item, index) => (
        <li key={item} className="flex gap-2 text-sm break-keep">
          <span className="shrink-0 tabular-nums text-muted-foreground">{index + 1}.</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

// 모집 조건 행 (라벨 위 · 값 아래) — 값이 자유 텍스트라 좌우 정렬로는 넘친다(SPEC 1번).
// `note`는 값 아래 보조 줄(muted·일반 굵기) — 사택 원문 표현처럼 본문(판정)과 무게가 달라야 하는 것.
// 같은 굵기로 이으면 같은 말을 두 번 한 것으로 읽힌다.
function ConditionRow({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string | null;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      {/* 크롤러가 원문 줄바꿈을 살려 넘긴다(모집 인원 "- 유아유치부 1명 / - 고등부 1명"). 여기서 접으면
          한 줄로 붙어 읽히지 않는다 — 공고 안내 본문과 같은 규칙으로 줄을 살린다 */}
      <dd className="mt-0.5 text-sm font-medium break-keep whitespace-pre-line">
        {value}
        {note && (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{note}</span>
        )}
      </dd>
    </div>
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
function PostHeader({
  job,
  church,
  preview,
}: {
  job: Job;
  church: JobChurchRef;
  preview: boolean;
}) {
  const meta = churchMetaLine(church);
  // 직분이 "기타"뿐이고 직무·부서·고용형태도 없으면 ""(67건) — 빈 줄을 그리지 않는다
  const roleLine = jobRoleLine(job, { full: true });
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
        <JobActions id={job.id} disabled={preview} />
      </div>

      <div className="mt-5">
        <h1 className="text-2xl leading-snug font-bold break-keep">{job.title}</h1>
        {roleLine && <p className="mt-2 text-sm text-muted-foreground">{roleLine}</p>}
      </div>
    </div>
  );
}

/**
 * 지원 방법 — 공고가 공개한 연락처를 **전부** 보여준다. 순서는 `APPLY_METHODS` 정의 순서
 * (링크 > 이메일 > 우편 > 전화 — 앞셋은 서류를 내는 경로, 전화는 대개 문의용).
 *
 * **홈페이지 링크만 클릭 대상이고, 그것도 주소 하나로 파싱될 때만이다**(`normalizeExternalUrl` —
 * 스킴 없는 도메인은 살리고, 쉼표·괄호가 섞이거나 주소가 아니면 글자로 둔다). 이메일·전화는 글자로만
 * 보인다 — `mailto:`·`tel:`은 기기 설정에 따라 아무 일도 일어나지 않거나 엉뚱한 앱이 열리고, 전화는
 * 실데이터 절반에 "(행정)" 같은 꼬리표가 붙어 있어 링크로 만들면 틀린다(2026-09-04 실측 1074건 중 563건).
 * 우편 주소는 애초에 열 것이 없다.
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
      {shown.map(({ key, value }) => {
        const href = key === "LINK" && value ? normalizeExternalUrl(value) : null;
        return (
          <div key={key}>
            <dt className="text-xs text-muted-foreground">{APPLY_METHODS[key]}</dt>
            <dd className="mt-0.5 text-sm font-medium break-words">
              {/* 글자는 원문 그대로, href만 정규화 — 교회가 적은 모양을 바꾸지 않는다 */}
              {href ? (
                <a
                  href={href}
                  {...externalLinkAttrs}
                  className="text-primary underline underline-offset-4"
                >
                  {value}
                </a>
              ) : (
                value
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

// 좌측 본문 — 사례비·마감·고용형태는 우측 카드, 나머지 조건·내용은 여기
function MainContent({
  job,
  church,
  churchRef,
  churchJobs,
  isPubliclyOpen,
}: {
  job: Job;
  church: Church | null;
  churchRef: JobChurchRef;
  churchJobs: JobCardData[];
  isPubliclyOpen: boolean;
}) {
  // 위치·사택 표기 규칙은 lib/format이 단일 소스(교회 상세도 같은 함수를 쓴다)
  const location = churchPlaceLine(churchRef);
  const facetLinks = facetsOfJob({
    region: churchRef.region,
    position: job.position,
    department: job.department,
  });
  const housing = housingDisplay(job);
  const mapUrl = naverMapUrl(churchRef);

  return (
    <div>
      <Section title="모집 조건" first>
        <dl className="mt-3 space-y-3">
          {job.headcount && <ConditionRow label="모집 인원" value={job.headcount} />}
          {job.startTiming && <ConditionRow label="부임 시기" value={job.startTiming} />}
          <ConditionRow label="출근" value={job.workDays ?? "협의"} />
          {/* 사택은 `null`(정보 없음/협의)·`true`·`false`가 서로 다른 값이다 — 표기는 `housingDisplay`가
              단일 소스(판정이 본문, 원문 표현은 보조 줄)이고, 정보가 전혀 없으면 null을 돌려 이 줄이
              사라진다(DATA §3) */}
          {housing && <ConditionRow label="사택" value={housing.label} note={housing.note} />}
          {job.benefitNote && <ConditionRow label="복리후생" value={job.benefitNote} />}
          {/* 수집 공고(원문 링크 있음)에는 첨부 안내 한 줄 — 원문 게시판에 이력서 양식 같은 파일이 붙어 있어도 우리는
              파일을 저장·링크하지 않는다(저작권 · 첨부 URL이 게시판 세션에 묶여 어차피 안 열린다). 그런데 본문에는
              "(첨부파일 다운로드)"가 168건 남아 있어 받을 곳이 없어 보였다. **임시 방식**(운영자 결정 2026-09-05):
              첨부 유무를 모르므로 수집 공고 전부에 "있으면 원문에서"로 쓴다. 정식은 크롤러가 `jobs`에 첨부 이름
              칸을 채우는 것(ROADMAP 크롤러 전달) — 그때 이 줄을 "있는 공고에만 · 파일 이름과 함께"로 바꾼다.
              링크는 걸지 않는다 — 원문 링크는 우측 카드 한 곳에만 둔다(`SummaryAside` 주석). */}
          <ConditionRow
            label="제출 서류"
            value={<DocList required={job.requiredDocs} optional={job.optionalDocs} />}
            note={job.sourceUrl ? "첨부 양식이 있으면 ‘원문 공고 보기’에서 받아 주세요." : null}
          />
        </dl>
      </Section>

      {/* ⚠️ **비면 구획째 뺀다** — 형제 구획은 전부 그러는데 여기만 무조건 그려서 제목만 뜬
          빈 칸이 남아 있었다(실측 2026-08-27: 863건 중 77건이 `requirements=[]`). */}
      {job.requirements.length > 0 && (
        <Section title="자격 요건">
          <BulletList items={job.requirements} />
        </Section>
      )}

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

      {job.processSteps.length > 0 && (
        <Section title="전형 절차">
          <StepList items={job.processSteps} />
        </Section>
      )}

      {mapUrl && (
        <Section title="위치">
          {/* 지도는 주소 옆 링크 한 개다(네이버 지도 검색·새 탭). 한때 160px 빈 회색 상자(플레이스홀더)였는데
              임베드처럼 보여 "안 뜨는 지도"로 읽혔다(2026-08-30). 임베드는 Phase 2(API 키+주소 필드) */}
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span>{location}</span>
            <a
              href={mapUrl}
              {...externalLinkAttrs}
              className="font-semibold text-primary underline underline-offset-4"
            >
              지도에서 보기
            </a>
          </p>
        </Section>
      )}

      {/* 지원 방법 — 만료 공고에는 섹션째 생략한다. 받아주지 않는 곳으로 헛걸음을 시키고,
          마감 배너와도 모순된다. 그때는 우측 카드가 원문 링크만 남긴다(사실확인용). */}
      {isPubliclyOpen && (
        <Section title="지원 방법">
          {/* 안내문은 두지 않는다 — 연락처 자체가 "교회에 직접"이라는 뜻이다(2026-08-30 · 한때 출처별
              두 문장 → 한 문장 → 삭제). 출처 표기는 우측 카드의 원문 링크가 맡는다(가드레일 #1) */}
          <div className="mt-3">
            <ApplyMethods job={job} />
          </div>
        </Section>
      )}

      {/* 같은 조건 모아보기 — 지역·직분·부서 랜딩으로 가는 링크.
          사용자에겐 "이 조건의 다른 공고"라는 자연스러운 다음 행동이고, **공고 상세 900여 장이 랜딩 28개를
          계속 가리키는 내부 링크 그물**이 된다(랜딩의 발견 경로 · `lib/job-facets`). */}
      {facetLinks.length > 0 && (
        <Section title="같은 조건 모아보기">
          <ul className="mt-3 flex flex-wrap gap-2">
            {facetLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted/40"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
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
                  // 일반직(직분 없음)·"기타"뿐이면 ""라 점만 매달린다 — 조각째 뺀다
                  const position = publicPositionLabel(cj.position);
                  return (
                    <li key={cj.id}>
                      <Link
                        href={`/jobs/${cj.id}`}
                        className="group flex items-baseline justify-between gap-3 py-2.5 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate group-hover:underline">
                          {cj.title}
                          {position && <span className="text-muted-foreground"> · {position}</span>}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-semibold",
                            hasPay ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {formatPayShort(cj)}
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
      {/* 원문·홈페이지 링크 — 이전 "지원하기" 버튼 자리에 그대로 두되 **outline으로 격하**한다.
          지원 동선은 본문 "지원 방법"의 연락처가 맡고, 이 버튼의 일은 사실확인 + 출처 표기다.
          링크는 여기 한 곳에만 둔다 — 본문에도 두면 같은 URL이 한 화면에 두 번 나온다. */}
      {(sourceLink || !isPubliclyOpen || job.source === "CHURCH") && (
        <div className="border-b p-5">
          {!isPubliclyOpen && (
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              모집이 끝난 공고예요. 내용 확인용으로만 남겨둡니다.
            </p>
          )}
          {/* 교회가 직접 올린 공고는 **이 페이지가 원문**이라 원문 링크가 없다 — 그 자리에 왜 없는지를
              말하는 배지를 둔다(2026-08-29). 인증 교회가 올렸다는 신뢰 표시이기도 하다.
              ⚠️ 클레임으로 가져온 공고(source=CHURCH인데 원문 링크가 남음)에는 안 단다(2026-09-01) —
              "직접 등록"이 거짓이 되고, 출처 표기(가드레일 #1)는 그 원문 링크가 계속 맡는다. */}
          {job.source === "CHURCH" && !job.sourceUrl && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              교회가 직접 등록한 공고예요
            </p>
          )}
          {sourceLink && (
            <a
              href={sourceLink.url}
              {...externalLinkAttrs}
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "w-full")}
            >
              {sourceLink.label}
            </a>
          )}
        </div>
      )}
      <dl className="space-y-3 p-5">
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
          value={
            job.employmentType ? (
              EMPLOYMENT_TYPES[job.employmentType]
            ) : (
              // 부재는 강조하지 않는다 — 사례비 금액과 같은 굵기면 없는 정보가 값처럼 읽힌다
              <span className="font-normal text-muted-foreground">정보 없음</span>
            )
          }
        />
      </dl>
    </Card>
  );
}

// 비슷한 공고 (하단) — 공고가 끝난 뒤의 **추천 모듈**이라 본문 구획과 달리 보여야 한다(2026-08-30).
// 페이지에서 유일한 구분선 + 큰 여백이 "여기서 공고가 끝난다"를 말하고(본문은 여백형이라 선이 없다),
// 제목은 본문 구획보다 한 단계 크며 "더 보기"는 제목 줄 끝에 둔다 — 한때 제목 크기가 본문 구획과 같아서
// 이 공고의 아홉 번째 구획처럼 읽혔다.
// 첫 칸은 광고 자리다(`PlacedJob.ad`) — 카드 모양은 같고 회색 "광고" 텍스트만 다르다(SPEC 수익화 절).
function SimilarJobsSection({ jobs, moreHref }: { jobs: PlacedJob[]; moreHref: string }) {
  return (
    <section id="similar-jobs" className="mt-12 scroll-mt-20 border-t pt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">비슷한 공고</h2>
        <Link
          href={moreHref}
          className="shrink-0 text-sm font-semibold text-primary underline underline-offset-4"
        >
          더 보기 →
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map(({ job, ad }) => (
          <JobCard key={job.id} job={job} ad={ad} />
        ))}
      </div>
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

export function JobDetailView({
  detail,
  churchJobs,
  similar,
  preview = false,
}: {
  detail: JobDetail;
  churchJobs: JobCardData[];
  similar: PlacedJob[];
  /** 등록 폼의 미리보기(`JobPreview`) — 아직 없는 공고라 저장·공유 버튼을 끈다 */
  preview?: boolean;
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

      {!detail.isPubliclyOpen && <ClosedBanner job={job} hasSimilar={similar.length > 0} />}

      <PostHeader job={job} church={churchRef} preview={preview} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <MainContent
          job={job}
          church={church}
          churchRef={churchRef}
          churchJobs={churchJobs}
          isPubliclyOpen={detail.isPubliclyOpen}
        />
        <SummaryAside job={job} sourceLink={sourceLink} isPubliclyOpen={detail.isPubliclyOpen} />
      </div>

      {/* 하단 "운영자 등록 공고예요. 잘못된 정보가 있으면 문의해 주세요." 문장은 뺐다(2026-08-30) —
          출처는 우측 카드 원문 링크가, 문의는 푸터가 맡는다 */}
      {similar.length > 0 && <SimilarJobsSection jobs={similar} moreHref={moreHref} />}
    </div>
  );
}
