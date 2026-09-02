"use client";

import { JobCard } from "@/components/job/job-card";
import { formatPay, housingDisplay, payLabel } from "@/lib/format";
import { isDenominationPublished } from "@/lib/review-flags";
import type { ReviewEdits } from "@/lib/review-edits";
import type { JobCard as JobCardData } from "@/types/domain";

// 공개 미리보기 — "승인하면 어떻게 보이나"에 대한 답.
//
// 카드는 **공개 화면과 같은 컴포넌트**(`components/job/job-card`)를 그대로 쓴다. 검수용으로 비슷한
// 카드를 새로 만들면 공개 화면이 바뀔 때 미리보기가 조용히 거짓말을 하게 된다.
//
// ⚠️ 여기서 값을 **공개 규칙대로 깎는다** — 그것이 이 탭의 요점이다:
//    · 교단은 근거가 `stated`·`registry`·`operator`가 아니면 크롤러가 내보내지 않는다
//    · `jobs.pay_period`는 NOT NULL DEFAULT 'MONTH'라 주기 없는 금액은 **월급으로** 나간다

export function PublicPreview({
  draft,
  row,
  willShow,
}: {
  draft: ReviewEdits;
  row: { id: string; posted_at: string };
  /** 공개 목록에 실제로 뜨는가 — 판정은 `job-visibility`가 하고 결과만 받는다 */
  willShow: boolean;
}) {
  const job: JobCardData = {
    id: row.id,
    isPubliclyOpen: willShow,
    title: draft.title ?? "(제목 없음)",
    church: {
      name: draft.church_name ?? "(교회명 없음)",
      denomination: isDenominationPublished(draft.denomination_source) ? draft.denomination : null,
      region: draft.region,
      city: draft.city,
    },
    position: draft.position,
    role: draft.role,
    department: draft.department,
    employmentType: draft.employment_type,
    qualification: draft.qualification,
    housingProvided: draft.housing_provided,
    payMin: draft.pay_min,
    payMax: draft.pay_max,
    payNote: draft.pay_note,
    payPeriod: draft.pay_period ?? "MONTH",
    featuredTier: "NONE",
    postedAt: row.posted_at,
    deadline: draft.deadline,
  };

  const housing = housingDisplay({
    housingProvided: draft.housing_provided,
    housingNote: draft.housing_note,
  });
  const conditions: [string, string | null][] = [
    [payLabel(draft.job_kind), formatPay(job)],
    // 공개 상세는 판정 아래 원문 표현을 보조 줄로 그린다 — 여기는 값 확인용이라 다른 줄처럼 " · "로 잇는다
    ["사택", housing && [housing.label, housing.note].filter(Boolean).join(" · ")],
    ["마감", draft.deadline ?? "상시모집"],
    ["필수 서류", draft.required_docs.join(" · ") || null],
    ["전형 절차", draft.process_steps.join(" · ") || null],
    ["지원 요건", draft.requirements.join(" · ") || null],
  ];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-bold text-muted-foreground">목록 카드</h3>
        {/* 미리보기는 링크가 아니다 — 누르면 없는 공고로 간다(검수 id는 공고 id가 아니다) */}
        <div className="pointer-events-none mt-1.5 max-w-md">
          <JobCard job={job} preview />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3">
        <h3 className="text-xs font-bold text-muted-foreground">상세에 나가는 값</h3>
        <dl className="mt-1.5 space-y-1 text-sm">
          {conditions
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <dt className="w-20 shrink-0 text-xs text-muted-foreground">{label}</dt>
                <dd className="min-w-0 flex-1 break-keep">{value}</dd>
              </div>
            ))}
        </dl>
        <p className="mt-2 border-t pt-2 text-sm leading-relaxed break-keep">
          {draft.description ?? (
            <span className="text-destructive">
              설명이 비어 있습니다 — 상세가 빈 채로 나갑니다.
            </span>
          )}
        </p>
      </div>

      <MissingFilters draft={draft} />
    </div>
  );
}

/**
 * 검색에서 빠지는 축 — `/jobs`의 필터는 **미상(null)을 탈락시킨다**(filter-jobs.ts: "모르는 값을
 * 아무 칸에나 넣으면 필터가 거짓말이 된다"). 그래서 값이 비면 공개돼도 그 필터로는 못 찾는다.
 * 검수에서 채울 값의 우선순위가 여기서 보인다.
 */
function MissingFilters({ draft }: { draft: ReviewEdits }) {
  const missing = [
    !isDenominationPublished(draft.denomination_source) && "교단",
    draft.region === null && "지역",
    draft.department === null && "부서",
    draft.employment_type === null && "고용형태",
    draft.qualification === null && "자격",
    draft.pay_min === null && draft.pay_max === null && `${payLabel(draft.job_kind)} 금액`,
    draft.housing_provided !== true && "사택 제공",
  ].filter((label): label is string => Boolean(label));

  if (missing.length === 0) {
    return <p className="text-xs text-muted-foreground">모든 필터 축에 값이 있습니다.</p>;
  }
  return (
    <p className="text-xs leading-relaxed break-keep text-muted-foreground">
      <b className="text-foreground">이 필터로는 못 찾습니다</b> — {missing.join(" · ")}. 값이 비면
      그 축을 고른 방문자에게 안 보입니다(미상은 탈락).
    </p>
  );
}
