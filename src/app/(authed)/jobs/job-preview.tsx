"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { JobCard } from "@/components/job/job-card";
import { JobDetailView } from "@/app/(public)/jobs/[id]/job-detail-view";
import { DeviceFrame } from "./device-frame";
import { jobChurchRef } from "@/lib/job-church";
import { isPubliclyOpen } from "@/lib/job-visibility";
import { toUpdate, type JobDraft } from "@/lib/job-draft";
import type { Church, Job, JobCard as JobCardData } from "@/types/domain";

// 등록 전 미리보기 — "이렇게 올라갑니다"에 대한 답.
//
// **공개 화면 컴포넌트를 그대로 그린다** — 목록은 `components/job/job-card`, 상세는
// `(public)/jobs/[id]/job-detail-view`. 미리보기용으로 비슷한 화면을 새로 만들면 공개 화면이
// 바뀔 때 미리보기가 **조용히 거짓말**을 한다(수집 검수의 `public-preview.tsx`와 같은 판단).
// 전에는 값을 표로 늘어놓았는데, 그건 "어떻게 보이나"에 답하지 못했다(2026-08-26 교체).
//
// ⚠️ **값도 저장될 모양으로 깎아서 본다** — `toUpdate`를 통과시킨다. 숫자를 적으면 "협의" 표현이
//    버려지고, 고르지 않은 종류의 자리는 비워진다. 폼 상태를 그대로 그리면 그 차이가 안 보인다.
// ⚠️ **`JobDetailView`는 서버 컴포넌트가 아니다**(`"use client"`가 없을 뿐) — import가 전부
//    client-safe해서 이 client 트리 안에서 그려진다. 쿼리 모듈을 부르지 않는다.
// ⛔ **접었다 펴는 자리**다(별 스텝이 아니다). 미리보기는 꼭 봐야 하는 단계가 아니라 보고 싶을 때
//    보는 것이고, 스텝으로 만들면 "한 단계 더 남았다"는 부담이 생긴다.

type Tab = "list" | "detail";

/**
 * 미리보기 뷰포트(CSS px) — 실제 기기 기준(390 = iPhone 14). 이 값이 **iframe의 폭**이자
 * 틀의 폭이다(아래 `style`) — `DeviceFrame`이 자리에 맞춰 줄일 때 기준이 되는 수라 **두 곳에
 * 같은 숫자를 적지 않는다**. 이 폭에서는 `sm:`(640)·`md:`(768)·`lg:`(1024)가 **하나도 켜지지
 * 않아** 진짜 모바일 레이아웃이 나온다.
 *
 * ⛔ **PC 미리보기를 없앴다**(2026-08-27). 폼이 `max-w-3xl`(768px)이고 그 안에 카드·구획의 여백이
 *    겹쳐 실제 자리는 **650px**다. 거기에 1280px를 그리면 **0.51배로 줄어 글자가 읽히지 않았다**
 *    — 제목이 뭉개져 보이는 화면을 보고 "괜찮네" 하고 넘어가게 만드는, 미리보기로서는 최악인
 *    상태였다(거짓 안심).
 *    · 미리보기의 목적은 **"내가 적은 게 어떻게 나오나"** 이지 반응형 검증이 아니다. 오타·빠진
 *      값·사례비 표기를 보러 오는 것이고, 그건 한 폭으로 충분하다.
 *    · 구직 교역자는 폰으로 본다(SPEC 모바일 퍼스트) — 보여줄 폭을 하나만 고른다면 이쪽이다.
 *    · 목록 카드는 PC·모바일이 거의 같게 생겨서 애초에 두 폭을 보여줄 값어치가 적었다.
 *    PC 폭을 제대로 보여주려면 미리보기가 **폼 밖으로 나가 화면 폭을 다 써야** 한다(모달 등).
 *    그건 폼 레이아웃을 건드리는 별건이라, 하려면 그때 이 결정을 뒤집는다.
 */
const MOBILE_VIEWPORT = 390;

/**
 * 틀 높이는 **탭이 정한다** — 목록 카드는 한 장이라 짧고, 상세는 한 페이지다.
 * ⚠️ 하나로 고정하면 목록 탭에서 카드가 빈 공간을 다 차지한다(`JobCard`가 `h-full`이다).
 */
const HEIGHTS: Record<Tab, number> = { list: 210, detail: 620 };

export function JobPreview({
  draft,
  church,
  postedAt,
}: {
  draft: JobDraft;
  church: Church;
  /**
   * 수정이면 원래 게시일, 등록이면 오늘 — 카드의 "며칠 전"이 실제와 같아야 한다.
   * ⚠️ **마감 판정의 "오늘"로도 쓴다.** 등록이면 둘이 같고, 수정이면 과거 게시일로 판정해
   *    이미 지난 마감일을 "아직 모집 중"으로 보여줄 수 있다 — 실제 화면은 오늘로 판정하므로
   *    그 한 경우만 미리보기가 더 낙관적이다. 별 `today`를 받으면 폼이 두 날짜를 관리해야 해서
   *    지금은 이 절충을 택했다.
   */
  postedAt: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("list");

  const job = previewJob(draft, church, postedAt);
  const churchRef = jobChurchRef(job, church);
  const visible = isPubliclyOpen(job, postedAt);
  const card = previewCard(job, churchRef, visible);

  return (
    <section className="mt-4 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">미리보기</p>
          <p className="mt-0.5 text-xs break-keep text-muted-foreground">
            구직자에게 이렇게 보여요. 등록 전에 확인해 보세요.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(!open)}>
          {open ? "접기" : "펼쳐 보기"}
        </Button>
      </div>

      {open && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {/* 구직자가 보는 순서대로 — 목록에서 만나고, 눌러서 상세로 */}
            <Toggle on={tab === "list"} onClick={() => setTab("list")}>
              목록
            </Toggle>
            <Toggle on={tab === "detail"} onClick={() => setTab("detail")}>
              상세
            </Toggle>
          </div>

          {/* 기기 프레임 — iframe이라 그 안에서 반응형이 실제처럼 갈린다.
              폭은 실제 기기 그대로 가운데 두고, 자리가 그보다 좁으면(폼을 폰으로 볼 때)
              `max-w-full`이 자리를 좁혀 `DeviceFrame`이 그만큼 줄인다. */}
          <div
            className="mx-auto mt-3 max-w-full overflow-hidden rounded-2xl border shadow-sm"
            style={{ width: MOBILE_VIEWPORT }}
          >
            <DeviceFrame viewport={MOBILE_VIEWPORT} height={HEIGHTS[tab]}>
              {tab === "list" ? (
                <div className="p-3">
                  <JobCard job={card} />
                </div>
              ) : (
                // 비슷한 공고·교회 지난 공고는 아직 없는 공고라 빈 배열이다(그 구획이 스스로 빠진다)
                <JobDetailView
                  detail={{ job, church, churchRef, isPubliclyOpen: visible }}
                  churchJobs={[]}
                  similar={[]}
                  preview
                />
              )}
            </DeviceFrame>
          </div>
        </>
      )}
    </section>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * draft → 저장될 모양의 `Job`. **`toUpdate`가 만든 행을 도메인 타입으로 옮긴다** — 화면이 입력
 * 그대로가 아니라 DB에 들어갈 값을 보여줘야 미리보기가 뜻을 갖는다.
 *
 * ⚠️ `id`는 미리보기 전용 값이다 — 상세 뷰가 링크에 쓰지만 아직 공고가 없다. 저장·공유 버튼은
 *    `preview`로 꺼 둔다(저장 액션까지 가면 FK 위반이다).
 */
function previewJob(draft: JobDraft, church: Church, postedAt: string): Job {
  const row = toUpdate(draft);
  return {
    id: "preview",
    churchId: church.id,
    churchName: church.name,
    denomination: church.denomination,
    region: church.region,
    city: church.city,
    address: church.address,
    title: row.title || "(제목을 적어 주세요)",
    jobKind: row.job_kind,
    position: row.position,
    role: row.role,
    department: row.department,
    employmentType: row.employment_type,
    qualification: row.qualification,
    headcount: row.headcount,
    startTiming: row.start_timing,
    housingProvided: row.housing_provided,
    housingNote: row.housing_note,
    benefitNote: row.benefit_note,
    payMin: row.pay_min,
    payMax: row.pay_max,
    payNote: row.pay_note,
    payPeriod: row.pay_period,
    // 등록하면 바로 게재된다(검수 없음 · 가드레일 #1). 마감일로 안 뜨는 경우는 `isPubliclyOpen`이 본다
    status: "OPEN",
    featuredTier: "NONE",
    featuredUntil: null,
    postedAt,
    deadline: row.deadline,
    workDays: row.work_days,
    requirements: row.requirements,
    preferred: row.preferred,
    requiredDocs: row.required_docs,
    optionalDocs: row.optional_docs,
    processSteps: row.process_steps,
    description: row.description || "(본문을 적어 주세요)",
    // 교회가 직접 쓴 공고라 원문 링크가 없다 — `jobs_collected_needs_source_url`이 면제하는 그 경우다
    source: "CHURCH",
    sourceUrl: null,
    contactEmail: row.contact_email,
    contactTel: row.contact_tel,
    contactLink: row.contact_link,
    contactPost: row.contact_post,
  };
}

/** 목록 카드 projection — `lib/queries/jobs.ts`의 `toCard`와 같은 모양이어야 한다 */
function previewCard(
  job: Job,
  churchRef: ReturnType<typeof jobChurchRef>,
  visible: boolean,
): JobCardData {
  return {
    id: job.id,
    isPubliclyOpen: visible,
    title: job.title,
    church: {
      name: churchRef.name,
      denomination: churchRef.denomination,
      region: churchRef.region,
      city: churchRef.city,
    },
    position: job.position,
    role: job.role,
    department: job.department,
    employmentType: job.employmentType,
    qualification: job.qualification,
    housingProvided: job.housingProvided,
    payMin: job.payMin,
    payMax: job.payMax,
    payNote: job.payNote,
    payPeriod: job.payPeriod,
    featuredTier: job.featuredTier,
    postedAt: job.postedAt,
    deadline: job.deadline,
  };
}
