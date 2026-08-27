"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import { ChipMultiSelect, ChipSelect } from "@/components/job/chip-select";
import { ListField } from "./list-field";
import { CheckList } from "./check-list";
import { StepBar, FlowSection, TOTAL_STEPS } from "./job-wizard";
import { ChurchSummaryCard } from "./church-fields";
import { JobPreview } from "./job-preview";
import { createJob, updateJob } from "./actions";
import {
  APPLY_METHODS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  HOUSING_OPTIONS,
  JOB_KINDS,
  POSITIONS,
  PREFERRED_PRESETS,
  QUALIFICATION_PRESETS,
  QUALIFICATIONS,
  REQUIRED_DOC_PRESETS,
  PAY_NOTE_PRESETS,
  PAY_PERIODS,
  type ApplyMethod,
} from "@/constants/domain";
import {
  draftErrors,
  MAX_LENGTHS,
  type DraftErrors,
  type DraftField,
  type JobDraft,
} from "@/lib/job-draft";
import type { Church, Job } from "@/types/domain";

// 순서는 `APPLY_METHODS`와 같게 둔다 — 그쪽이 표시 순서의 단일 소스다(Record라 동작엔 무관)
const METHOD_PLACEHOLDER: Record<ApplyMethod, string> = {
  LINK: "접수 링크 URL",
  EMAIL: "접수 이메일 (예: recruit@church.org)",
  POST: "접수 주소 / 수신처 (예: ○○교회 청빙위원장 귀하)",
  TEL: "접수 전화번호",
};

// draft의 모양·검증·DB 변환은 `lib/job-draft`가 단일 소스다 — 폼과 Server Action이 같은 답을
// 써야 해서다(제출은 액션이 같은 검증을 다시 돌린다). 여기 남는 것은 **화면 조립**뿐이다.

// 저장된 연락처 4칸 → 폼의 접수 방법 맵. `APPLY_METHODS` 닫힌 4키와 1:1이라 표 하나로 끝난다.
// (이전엔 `sourceUrl`을 LINK 칸에 넣었다 — 교회 공고는 `sourceUrl`이 null이라 **수정 화면이
//  접수 방법을 비운 채 열렸고**, 필수 검증에 걸려 교회가 매번 다시 입력해야 했다.)
function applyMethodsOf(job?: Job): Partial<Record<ApplyMethod, string>> {
  const saved: Record<ApplyMethod, string | null | undefined> = {
    EMAIL: job?.contactEmail,
    LINK: job?.contactLink,
    TEL: job?.contactTel,
    POST: job?.contactPost,
  };
  return Object.fromEntries(
    (Object.entries(saved) as [ApplyMethod, string | null | undefined][]).filter(
      (entry): entry is [ApplyMethod, string] => Boolean(entry[1]),
    ),
  );
}

function toDraft(job?: Job): JobDraft {
  return {
    // 종류는 공고의 성격이라 기본값을 주지 않는다 — 사역직으로 미리 골라 두면 일반직 공고가
    // 그대로 사역직으로 올라간다(직분 칩이 필수가 되어 티는 나지만, 기본값이 답을 유도한다)
    jobKind: job?.jobKind ?? [],
    title: job?.title ?? "",
    position: job?.position ?? [],
    role: job?.role ?? "",
    department: job?.department ?? null,
    employmentType: job?.employmentType ?? null,
    qualification: job?.qualification ?? null,
    headcount: job?.headcount ?? "",
    startTiming: job?.startTiming ?? "",
    workDays: job?.workDays ?? "",
    description: job?.description ?? "",
    // 자격·우대는 `required`를 쓰지 않는다(제출 서류만 필수/선택을 가른다) — 같은 부품을 쓰려고 채운다
    requirements: (job?.requirements ?? []).map((name) => ({ name, required: true })),
    preferred: (job?.preferred ?? []).map((name) => ({ name, required: true })),
    payMin: job?.payMin?.toString() ?? "",
    payMax: job?.payMax?.toString() ?? "",
    payNote: job?.payNote ?? "",
    payPeriod: job?.payPeriod ?? "MONTH",
    housing: housingOf(job),
    housingNote: housingNoteOf(job),
    benefitNote: job?.benefitNote ?? "",
    docs: [
      ...(job?.requiredDocs ?? []).map((name) => ({ name, required: true })),
      ...(job?.optionalDocs ?? []).map((name) => ({ name, required: false })),
    ],
    processSteps: job?.processSteps ?? [],
    applyMethods: applyMethodsOf(job),
    deadline: job?.deadline ?? "",
    alwaysOpen: job ? job.deadline === null : false,
  };
}

/** 저장된 사택 두 컬럼 → 칩 하나. 제공 여부를 모르는데 설명이 있으면 "협의"로 읽는다 */
function housingOf(job?: Job): JobDraft["housing"] {
  if (!job) return null;
  if (job.housingProvided === true) return "PROVIDED";
  if (job.housingProvided === false) return "NONE";
  return job.housingNote ? "NEGOTIABLE" : null;
}

/**
 * 저장된 설명 → 입력칸. **`"협의"`는 빼고 준다** — 그건 교회가 쓴 글이 아니라 위 칩이 자기를
 * 표현하려고 넣어 둔 한 단어다(`job-draft`의 `housing`). 그대로 넣으면 교회가 적은 적 없는
 * 글자가 칸에 나타나고, 지우면 칩이 "협의"에서 풀린다.
 */
function housingNoteOf(job?: Job): string {
  const note = job?.housingNote;
  return !note || note === "협의" ? "" : note;
}

// 칸 → 스텝. 검증에 걸리면 **첫 미충족 스텝으로 점프**해 그 칸을 보여준다.
// 규칙 자체는 `lib/job-draft`의 `draftErrors`가 갖고, 여기 있는 것은 "어느 화면에 있나"뿐이다.
const FIELD_STEP: Record<DraftField, number> = {
  jobKind: 1,
  title: 1,
  position: 1,
  role: 1,
  employmentType: 1,
  // ⚠️ **본문도 1단계다** — `공고 본문` 구획이 1단계 마지막에 있다. 2로 적어 두면 검증이 실패했을 때
  //    그 칸이 없는 화면으로 점프해 "표시된 곳을 채우세요"만 뜨고 표시된 곳이 없다(실측 2026-08-26).
  description: 1,
  pay: 2,
  housing: 2,
  applyMethods: 3,
  deadline: 3,
};

/**
 * 여러 칸이 한 규칙을 이루는 자리 — **어느 칸을 고쳐도 그 오류를 지운다.**
 * `patch`는 보통 고친 칸의 이름으로 오류를 지우는데(`DraftField`가 `JobDraft` 키와 같은 이름인
 * 이유), 사례비는 네 칸이 한 오류를 낳으므로 최대 칸을 고쳐도 `pay` 오류가 남는다.
 */
const FIELD_GROUP: Partial<Record<keyof JobDraft, DraftField>> = {
  payMin: "pay",
  payMax: "pay",
  payNote: "pay",
  payPeriod: "pay",
};

interface SectionProps {
  draft: JobDraft;
  patch: (partial: Partial<JobDraft>) => void;
}

interface SectionDef {
  key: string;
  title: string;
  optional?: boolean;
  description?: string;
  content: ReactNode;
}

// 사례비 — 숫자(min·max)와 비정형(내규·협의)을 동급 경로로 (인터뷰: 대부분 비공개).
function PayFields({ draft, patch, error }: SectionProps & { error?: string }) {
  const presetOptions = Object.fromEntries(PAY_NOTE_PRESETS.map((p) => [p, p])) as Record<
    string,
    string
  >;
  const presetValue = (PAY_NOTE_PRESETS as readonly string[]).includes(draft.payNote)
    ? draft.payNote
    : null;
  return (
    <Field label="사례비 (만원)" optional group error={error}>
      {/* 기간을 먼저 고르고 금액을 적는다. 재클릭 해제는 기본값(월)으로 — DB가 NOT NULL이라
          "기간 없음"이라는 상태가 없다(constants/domain.ts PAY_PERIODS). */}
      <ChipSelect
        options={PAY_PERIODS}
        value={draft.payPeriod}
        onChange={(v) => patch({ payPeriod: v ?? "MONTH" })}
      />
      <div className="mt-2 flex items-center gap-2">
        <Input
          inputMode="numeric"
          value={draft.payMin}
          onChange={(e) => patch({ payMin: e.target.value, payNote: "" })}
          placeholder="최소"
          aria-label="사례비 최소"
          className="h-9"
        />
        <span className="text-muted-foreground">~</span>
        <Input
          inputMode="numeric"
          value={draft.payMax}
          onChange={(e) => patch({ payMax: e.target.value, payNote: "" })}
          placeholder="최대"
          aria-label="사례비 최대"
          className="h-9"
        />
      </div>
      <div className="mt-3 space-y-2">
        <ChipSelect
          options={presetOptions}
          value={presetValue}
          onChange={(v) => patch({ payNote: v ?? "", payMin: "", payMax: "" })}
        />
        <Input
          value={presetValue ? "" : draft.payNote}
          onChange={(e) => patch({ payNote: e.target.value, payMin: "", payMax: "" })}
          placeholder="직접 입력 (예: 사역 경력에 따라 협의)"
          aria-label="사례비 비정형 표현"
          maxLength={MAX_LENGTHS.payNote}
          className="h-9"
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        선택하면 숫자 대신 이 표현이 공고에 그대로 노출돼요.
      </p>
    </Field>
  );
}

// 접수 방법 — 다중 선택. 고른 방법마다 접수처 입력. 사이트 내 지원 없음(가드레일) — 교회 채널 안내만.
function ApplyFields({ draft, patch, error }: SectionProps & { error?: string }) {
  const methods = draft.applyMethods;
  const toggle = (key: ApplyMethod) => {
    const next = { ...methods };
    if (key in next) delete next[key];
    else next[key] = "";
    patch({ applyMethods: next });
  };
  return (
    <Field label="접수 방법" required error={error}>
      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(APPLY_METHODS) as [ApplyMethod, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={key in methods}
            onClick={() => toggle(key)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              key in methods
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 space-y-2">
        {(Object.entries(APPLY_METHODS) as [ApplyMethod, string][])
          .filter(([key]) => key in methods)
          .map(([key, label]) => (
            <Input
              key={key}
              value={methods[key] ?? ""}
              onChange={(e) => patch({ applyMethods: { ...methods, [key]: e.target.value } })}
              placeholder={METHOD_PLACEHOLDER[key]}
              aria-label={`${label} 접수처`}
              maxLength={MAX_LENGTHS.contact}
              className="h-9"
            />
          ))}
        {/* 전화는 대개 문의용이라 개인정보 안내를 여기 붙인다(없앤 "문의처" 칸에 있던 문구) */}
        {"TEL" in methods && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            문의 전화로도 쓰여요. 개인 담당자 휴대폰 대신 교회 대표 번호를 권장해요.
          </p>
        )}
      </div>
    </Field>
  );
}

// 마감 — 상시모집을 1급 옵션으로 (인터뷰: 교회는 마감 개념이 다름)
function DeadlineFields({ draft, patch }: SectionProps) {
  return (
    <div className="space-y-3">
      <Field label="마감일">
        <Input
          type="date"
          value={draft.deadline}
          onChange={(e) => patch({ deadline: e.target.value, alwaysOpen: false })}
          disabled={draft.alwaysOpen}
          className="h-9"
        />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.alwaysOpen}
          onChange={(e) => patch({ alwaysOpen: e.target.checked, deadline: "" })}
          className="size-4 accent-primary"
        />
        청빙 시까지 — 적임자를 구할 때까지 (상시)
      </label>
      <p className="text-xs text-muted-foreground">오래된 공고는 확인 후 정리될 수 있어요.</p>
    </div>
  );
}

// ⛔ **"기타" 직접 입력칸을 두지 않는다**(2026-08-26 제거). `position`·`department`는 DB가 닫힌
//    enum이라 자유 텍스트를 저장할 컬럼이 없었고, 받아 놓고 **버리고 있었다**. `기타`만 저장한다.

function stepSections(
  step: number,
  draft: JobDraft,
  patch: SectionProps["patch"],
  church: Church,
  errors: DraftErrors,
): SectionDef[] {
  const errorOf = (field: DraftField) => errors[field];
  const ministry = draft.jobKind.includes("MINISTRY");
  const general = draft.jobKind.includes("GENERAL");
  if (step === 1) {
    return [
      {
        key: "church",
        title: "교회 정보",
        // ⚠️ 고칠 수 없다 — 미검증 값이 인증된 교회를 덮어쓰면 안 된다(인증 신청에서 같은 이유로 막았다).
        //    편집 칸을 두던 분기는 삭제했다: 인증을 통과한 교회는 항상 값이 있어 **도달하지 않는 코드**였다.
        description: "인증된 교회 정보로 게재돼요.",
        content: <ChurchSummaryCard church={church} />,
      },
      {
        key: "recruit",
        title: "모집 내용",
        content: (
          <>
            <Field label="공고 제목" required error={errorOf("title")}>
              <Input
                required
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                maxLength={MAX_LENGTHS.title}
                placeholder="예) 유초등부를 함께 섬길 전도사를 청빙합니다"
                className="h-9"
              />
            </Field>
            {/* 종류가 자리의 모양을 정한다 — 사역직은 직분(닫힌 목록), 일반직은 직무명(자유 텍스트).
                DB `jobs_kind_matches_seat`가 **짝을 강제**하므로 화면도 짝으로 그린다.

                ⛔ **하나만 고른다**(2026-08-26 · 다중선택에서 되돌렸다). `jobs.job_kind`는 배열이고
                   둘 다 담을 수 있지만, 그건 **크롤러가 원문 하나에 두 자리가 섞여 있을 때** 쓰는
                   것이다(실측 863건 중 10건 = 1.2%). 교회가 직접 올릴 때는 자리마다 따로 올리는 편이
                   낫다: 고용형태·사례비·부서가 **단일 값**이라 섞으면 한쪽이 거짓이 되고, 구직자
                   필터에도 어느 쪽으로 걸릴지 모호해진다. 등록은 무료라 두 번 올려도 비용이 없다. */}
            <Field label="모집 종류" required error={errorOf("jobKind")} group>
              <ChipSelect
                options={JOB_KINDS}
                value={draft.jobKind[0] ?? null}
                onChange={(v) => patch({ jobKind: v ? [v] : [] })}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                사역직은 직분을, 일반직은 직무명을 적어요. 자리가 둘이면 공고를 따로 올려 주세요.
              </p>
            </Field>
            {ministry && (
              <Field label="직분" required error={errorOf("position")}>
                <ChipMultiSelect
                  options={POSITIONS}
                  value={draft.position}
                  onChange={(v) => patch({ position: v })}
                />
              </Field>
            )}
            {general && (
              <Field label="직무명" required error={errorOf("role")}>
                <Input
                  value={draft.role}
                  onChange={(e) => patch({ role: e.target.value })}
                  placeholder="예) 행정간사 · 방송·미디어"
                  maxLength={MAX_LENGTHS.role}
                  className="h-9"
                />
              </Field>
            )}
            <Field label="담당 부서" optional>
              <ChipSelect
                options={DEPARTMENTS}
                value={draft.department}
                onChange={(v) => patch({ department: v })}
              />
            </Field>
            <Field label="고용형태" required error={errorOf("employmentType")} group>
              <ChipSelect
                options={EMPLOYMENT_TYPES}
                value={draft.employmentType}
                onChange={(v) => patch({ employmentType: v })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="모집 인원" optional>
                <Input
                  value={draft.headcount}
                  onChange={(e) => patch({ headcount: e.target.value })}
                  placeholder="예) 1명"
                  maxLength={MAX_LENGTHS.headcount}
                  className="h-9"
                />
              </Field>
              <Field label="부임 시기" optional>
                <Input
                  value={draft.startTiming}
                  onChange={(e) => patch({ startTiming: e.target.value })}
                  placeholder="예) 2026년 9월 · 협의"
                  maxLength={MAX_LENGTHS.startTiming}
                  className="h-9"
                />
              </Field>
            </div>
            <Field label="근무 요일" optional hint="파트 등 근무일이 정해진 경우에만 적어 주세요.">
              <Input
                value={draft.workDays}
                onChange={(e) => patch({ workDays: e.target.value })}
                placeholder="예) 주일·수요 / 주중 상근"
                maxLength={MAX_LENGTHS.workDays}
                className="h-9"
              />
            </Field>
          </>
        ),
      },
      {
        key: "qualifications",
        title: "자격 요건",
        optional: true,
        // ⛔ 구획 설명을 두지 않는다 — 안에 칸이 **둘**이라 설명이 어느 쪽 말인지 모호해진다
        //    (한때 "흔한 요건을 고르고…"가 바로 아래 자격 칩이 아니라 그 다음 목록을 가리켰다).
        //    각 칸이 자기 hint를 갖고, "선택" 배지는 구획에만 둔다(칸마다 붙이면 세 번 나온다).
        content: (
          <>
            {/* 닫힌 다섯 값 + 자유 목록을 **한 구획에** 둔다 — `/admin/jobs/[id]`가 이미 같은
                자리·같은 이름이다("자격 요건" 구획 = "자격" 행 + "요건" 행). 굵기가 다른 두 축이
                아니라 같은 질문의 거친 답과 자세한 답이다.
                ⚠️ 자격이 비면 **구직자의 자격 필터에서 통째로 빠진다**(filter-jobs.ts) — 크롤
                   공고는 70%가 값을 갖고 있어 필터가 실제로 도는 축이다. */}
            <Field
              label="자격"
              hint="구직자의 자격 필터에 쓰여요. 다섯 값에 없는 조건은 아래 요건에 적어 주세요."
            >
              <ChipSelect
                options={QUALIFICATIONS}
                value={draft.qualification}
                onChange={(v) => patch({ qualification: v })}
              />
            </Field>
            <Field label="요건" hint="흔한 것을 고르고, 필요하면 직접 추가하세요.">
              <CheckList
                presets={QUALIFICATION_PRESETS}
                items={draft.requirements}
                onChange={(v) => patch({ requirements: v })}
                addPlaceholder="예) 1종 보통 운전면허 소지자"
              />
            </Field>
          </>
        ),
      },
      {
        // `jobs.preferred`가 있는데 입력칸이 없어 **저장할 방법이 없던** 칸이다(2026-08-26 추가).
        // 자격과 나누는 이유: 공개 상세가 "자격 요건"과 "우대 사항"을 다른 무게로 그린다 —
        // 우대를 자격에 섞으면 지원자가 못 낸다고 읽는다.
        key: "preferred",
        title: "우대 사항",
        optional: true,
        description: "없어도 되지만 있으면 좋은 조건이에요.",
        content: (
          <CheckList
            presets={PREFERRED_PRESETS}
            items={draft.preferred}
            onChange={(v) => patch({ preferred: v })}
            addPlaceholder="예) 유아교육 전공"
          />
        ),
      },
      {
        // ⚠️ **필수다** — `jobs.description`이 `NOT NULL`이다. "선택"으로 표시하던 때는 비우고
        //    제출하면 DB가 거부해 "저장하지 못했어요"만 떴다(어느 칸인지 말할 수 없었다).
        key: "description",
        title: "공고 본문",
        description: "우리 교회와 사역을 소개해 주세요. 목록·검색에도 쓰이는 글이에요.",
        content: (
          <Field label="본문" required error={errorOf("description")}>
            <Textarea
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              maxLength={MAX_LENGTHS.description}
              placeholder="예) 저희 교회는 다음세대를 세우는 일에 힘쓰고 있어요. 함께 유초등부를 섬길 전도사님을 기다립니다."
              aria-label="공고 본문"
              className="min-h-32"
            />
          </Field>
        ),
      },
    ];
  }

  if (step === 2) {
    return [
      {
        key: "pay",
        title: "사례비 · 예우",
        content: (
          <>
            <PayFields draft={draft} patch={patch} error={errorOf("pay")} />
            <Field label="사택 제공" required error={errorOf("housing")} group>
              <ChipSelect
                options={HOUSING_OPTIONS}
                value={draft.housing}
                onChange={(v) => patch({ housing: v })}
              />
              {/* 칩이 담지 못하는 원문을 받는 칸 — 크롤 실데이터의 40%가 이 모양이다
                  ("사택 전세 지원 5천만원"). 없던 동안 수정이 원문을 "협의"로 덮었다. */}
              <Input
                value={draft.housingNote}
                onChange={(e) => patch({ housingNote: e.target.value })}
                placeholder="예) 전세 5천만원 지원 · 교회 인근 아파트"
                aria-label="사택 설명"
                maxLength={MAX_LENGTHS.housingNote}
                className="mt-2 h-9"
              />
            </Field>
            <Field label="처우 비고" optional>
              <Textarea
                value={draft.benefitNote}
                onChange={(e) => patch({ benefitNote: e.target.value })}
                placeholder="예) 4대보험·총회연금 50% 지원, 도서비·휴가비 별도"
                aria-label="처우 비고"
                maxLength={MAX_LENGTHS.benefitNote}
                className="min-h-24"
              />
            </Field>
          </>
        ),
      },
      {
        key: "docs",
        title: "제출 서류",
        description: "필요한 서류를 체크하고 필수·선택을 지정하세요. 지원자에게 안내돼요.",
        content: (
          <CheckList
            presets={REQUIRED_DOC_PRESETS}
            items={draft.docs}
            onChange={(v) => patch({ docs: v })}
            withRequired
            addPlaceholder="기타 서류명"
          />
        ),
      },
      {
        key: "process",
        title: "전형 절차",
        // ⛔ "선택" 뱃지를 뺐다 — 2단계는 배너가 이미 "모두 선택"이라 말하는데 여기만 뱃지가
        //    붙어 있어 **나머지 둘이 필수처럼** 보였다(사례비·제출 서류도 다 선택이다).
        description: "지원자가 절차를 미리 알 수 있어요.",
        content: (
          <ListField
            items={draft.processSteps}
            onChange={(v) => patch({ processSteps: v })}
            placeholder="예) 서류 심사 → 면접 → 설교"
          />
        ),
      },
    ];
  }

  return [
    {
      key: "apply",
      title: "지원 방법",
      // ⛔ **"문의처" 칸을 없앴다**(2026-08-26). `jobs`에 저장할 컬럼이 없어 적어도 **버려지던** 값이고,
      //    `contact_tel`이 이미 그 역할이다(공개 상세: "앞셋은 서류를 내는 경로, 전화는 대개 문의용").
      //    거기 있던 개인정보 안내는 전화 칸으로 옮겼다.
      content: <ApplyFields draft={draft} patch={patch} error={errorOf("applyMethods")} />,
    },
    {
      key: "deadline",
      title: "마감",
      content: <DeadlineFields draft={draft} patch={patch} />,
    },
  ];
}

// 공고 등록/수정 공유 폼 — 3스텝 위저드(모집 기본 → 처우·서류 → 지원·마감).
// 제출은 `./actions`의 `createJob`·`updateJob`이 받는다(검증→저장→`updateTag("jobs")`→대시보드).
// **폼이 미리 돌리는 검증은 왕복을 아끼려는 것뿐**이고 신뢰 경계는 액션이다 — 같은 `draftErrors`를
// 서버가 다시 돌린다.
export function JobForm({
  mode,
  church,
  initialJob,
}: {
  mode: "create" | "edit";
  church: Church;
  initialJob?: Job;
}) {
  const [draft, setDraft] = useState<JobDraft>(() => toDraft(initialJob));
  const [step, setStep] = useState(1);
  const [activeSec, setActiveSec] = useState(0);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  // 미리보기 카드의 "며칠 전"에 쓰는 오늘 — 첫 렌더에 고정한다(렌더마다 만들면 값이 흔들린다)
  const [today] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()),
  );
  const patch = (partial: Partial<JobDraft>) => {
    setDraft((d) => ({ ...d, ...partial }));
    // 고치기 시작한 칸의 오류는 즉시 지운다(재검증은 다음·제출 때) — 고치는 중에 빨간 글씨가
    // 남아 있으면 무엇이 아직 문제인지 알 수 없다
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(partial) as (keyof JobDraft)[])
        delete next[FIELD_GROUP[key] ?? (key as DraftField)];
      return next;
    });
  };

  const sections = stepSections(step, draft, patch, church, errors);

  // 스크롤 스파이 — 현재 뷰포트 상단에 걸친 섹션을 활성 표시(왼쪽 점). step 바뀌면 재관찰.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-fsec]"));
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveSec(els.indexOf(top.target as HTMLElement));
      },
      { rootMargin: "-110px 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [step]);

  const goTo = (n: number) => {
    setStep(Math.min(TOTAL_STEPS, Math.max(1, n)));
    setActiveSec(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** 이 스텝에 속한 오류만 — 규칙은 `draftErrors`가 갖고 여기선 자리만 고른다 */
  const errorsOnStep = (all: DraftErrors, at: number): DraftErrors =>
    Object.fromEntries(
      Object.entries(all).filter(([field]) => FIELD_STEP[field as DraftField] === at),
    );

  // 다음 — 현재 스텝의 칸만 검증하고, 통과할 때만 진행한다.
  const goNext = () => {
    const onStep = errorsOnStep(draftErrors(draft, initialJob?.deadline), step);
    if (Object.keys(onStep).length > 0) {
      setErrors(onStep);
      return;
    }
    setErrors({});
    goTo(step + 1);
  };

  // 이전 — 검증하지 않는다(뒤로 갈 때 막지 않음). 표시 중이던 오류는 정리.
  const goPrev = () => {
    setErrors({});
    goTo(step - 1);
  };

  /**
   * 제출 — 전 스텝을 검증하고 첫 미충족 스텝으로 점프한다. 통과하면 액션이 **같은 검증을 다시**
   * 돌린다(신뢰 경계는 서버다). 성공하면 액션이 `redirect`하므로 여기로 돌아오지 않는다.
   */
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // 저장돼 있던 마감일을 함께 넘긴다 — 액션도 같은 값으로 다시 검증한다(`job-draft`)
    const found = draftErrors(draft, initialJob?.deadline);
    const fields = Object.keys(found) as DraftField[];
    if (fields.length > 0) {
      const first = Math.min(...fields.map((field) => FIELD_STEP[field]));
      setErrors(errorsOnStep(found, first));
      goTo(first);
      return;
    }
    setErrors({});
    setFailure(null);
    startSave(async () => {
      try {
        const result = initialJob ? await updateJob(initialJob.id, draft) : await createJob(draft);
        // 성공하면 redirect가 나가 이 줄에 오지 않는다
        if (result?.errors) {
          const fromServer = result.errors;
          const at = Math.min(
            ...(Object.keys(fromServer) as DraftField[]).map((field) => FIELD_STEP[field]),
          );
          setErrors(errorsOnStep(fromServer, at));
          goTo(at);
        } else if (result?.message) setFailure(result.message);
      } catch (thrown) {
        // 리다이렉트 등 Next 제어 신호는 삼키지 않는다(admin/review와 같은 관용구)
        unstable_rethrow(thrown);
        console.error("[jobs] 저장 실패", thrown);
        setFailure("저장하지 못했어요. 적은 내용은 그대로 있으니 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-5 sm:p-6">
      <StepBar step={step} />

      <p className="mb-4 text-xs text-muted-foreground">
        <span className="text-destructive">*</span> 표시만 필수예요. 나머지는 건너뛰어도 등록돼요.
      </p>

      {/* 처우·서류 단계의 부담 완화 안내 — 공급(교회 등록) 확보 장치다.
          ⚠️ 한때 "이 단계는 모두 선택"이었는데 사택을 필수로 올리면서(2026-08-27) 거짓이 됐다.
             배너를 없애는 대신 **정확하게** 고쳤다 — 부담을 덜어 주는 말이 틀리면 더 나쁘다. */}
      {step === 2 && (
        <p className="mb-4 rounded-lg bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground">
          사택 하나만 필수예요. 나머지는 채우면 더 좋은 공고가 되지만, 비워도 바로 등록할 수 있어요.
        </p>
      )}

      <div ref={containerRef}>
        {sections.map((s, i) => (
          <FlowSection
            key={s.key}
            title={s.title}
            optional={s.optional}
            description={s.description}
            state={i === activeSec ? "active" : i < activeSec ? "done" : "todo"}
            last={i === sections.length - 1}
          >
            {s.content}
          </FlowSection>
        ))}
      </div>

      {/* 마지막 스텝에만 — 앞 스텝에서 펼치면 아직 안 적은 칸이 "(제목을 적어 주세요)"로 보여 혼란스럽다 */}
      {step === TOTAL_STEPS && (
        <JobPreview draft={draft} church={church} postedAt={initialJob?.postedAt ?? today} />
      )}

      {failure && (
        <p
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm font-semibold break-keep text-destructive"
          role="alert"
        >
          {failure}
        </p>
      )}

      {Object.keys(errors).length > 0 && (
        <p
          className="mt-4 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm break-keep text-destructive"
          role="alert"
        >
          표시된 곳을 채우면 등록할 수 있어요.
        </p>
      )}

      <div className="mt-4 flex gap-2.5">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12"
            disabled={saving}
            onClick={goPrev}
          >
            ← 이전
          </Button>
        )}
        {/* ⚠️ **`key`가 필수다 — 없으면 `다음`을 누른 것만으로 공고가 등록된다.**
            둘 다 같은 자리의 `<button>`이라 React가 **DOM 노드를 재사용**하고 `type`만
            `button` → `submit`으로 바꾼다. 브라우저는 클릭의 기본 동작(activation behavior)을
            **이벤트 전파가 끝난 뒤** 판정하는데, discrete 이벤트라 그 사이 React가 이미
            리렌더를 flush해 버려서 `type="submit"`인 버튼을 누른 것이 된다.
            → 2단계에서 `다음`을 한 번 누르면 3단계로 가면서 **폼이 제출된다**. 값이 다 차 있으면
              (수정 화면이 그렇다) 교회가 지원 방법·마감·미리보기를 보지도 못한 채 저장된다.
              값이 비어 있으면 3단계가 빨간 오류를 띄운 채 열린다(실측 2026-08-27).
            `key`를 주면 React가 하나를 unmount하고 다른 하나를 mount해 노드가 갈린다. */}
        {step < TOTAL_STEPS ? (
          <Button key="next" type="button" size="lg" className="h-12 flex-1" onClick={goNext}>
            다음 →
          </Button>
        ) : (
          <Button key="submit" type="submit" size="lg" className="h-12 flex-1" disabled={saving}>
            {saving ? "저장 중…" : mode === "create" ? "공고 등록" : "수정 내용 저장"}
          </Button>
        )}
      </div>
      {/* ⛔ "운영자 검수 후 게재"라고 적혀 있던 자리다 — **전수 검수는 2026-08-21에 철회됐다**
          (인증이 게이트고 등록하면 바로 게재). 그때 `/pricing`·`/about`의 같은 문구는 고쳤는데
          이것만 남아 거짓말을 하고 있었다(ROADMAP 1-4). */}
      {mode === "create" && step === TOTAL_STEPS && (
        <p className="mt-2.5 text-center text-xs text-muted-foreground">
          등록하면 바로 게재돼요. 등록은 무료입니다.
        </p>
      )}
    </form>
  );
}
