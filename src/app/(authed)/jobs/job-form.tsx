"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./form-section";
import { ChipSelect } from "./chip-select";
import { ListField } from "./list-field";
import { CheckList, type CheckItem } from "./check-list";
import { StepBar, FlowSection, STEP_TITLES, TOTAL_STEPS } from "./job-wizard";
import { ChurchFields, ChurchSummaryCard } from "./church-fields";
import {
  APPLY_METHODS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  HOUSING_OPTIONS,
  POSITIONS,
  QUALIFICATION_PRESETS,
  REQUIRED_DOC_PRESETS,
  STIPEND_NOTE_PRESETS,
  type ApplyMethod,
  type Department,
  type EmploymentType,
  type HousingOption,
  type Position,
} from "@/constants/domain";
import type { Church, Job } from "@/types/domain";

// textarea — shadcn Input과 같은 시각 문법 (별도 textarea 컴포넌트 미도입 상태)
const TEXTAREA_CLASS =
  "min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

const METHOD_PLACEHOLDER: Record<ApplyMethod, string> = {
  EMAIL: "접수 이메일 (예: recruit@church.org)",
  LINK: "접수 링크 URL",
  TEL: "접수 전화번호",
  POST: "접수 주소 / 수신처 (예: ○○교회 청빙위원장 귀하)",
};

// mock draft — Job 스키마보다 넓다(모집인원·부임시기·전형절차·접수방법·서류 필수여부는 Phase 1에서 DATA 반영).
interface JobDraft {
  title: string;
  position: Position | null;
  positionEtc: string;
  department: Department | null;
  departmentEtc: string;
  employmentType: EmploymentType | null;
  headcount: string;
  startTiming: string;
  workDays: string;
  intro: string;
  qualifications: CheckItem[];
  stipendMin: string;
  stipendMax: string;
  stipendNote: string;
  housing: HousingOption | null;
  benefitNote: string;
  docs: CheckItem[];
  processSteps: string[];
  applyMethods: Partial<Record<ApplyMethod, string>>;
  inquiry: string;
  deadline: string;
  alwaysOpen: boolean;
}

function toDraft(job?: Job): JobDraft {
  return {
    title: job?.title ?? "",
    position: job?.position ?? null,
    positionEtc: "",
    department: job?.department ?? null,
    departmentEtc: "",
    employmentType: job?.employmentType ?? null,
    headcount: "",
    startTiming: "",
    workDays: job?.workDays ?? "",
    intro: job?.description ?? "",
    qualifications: (job?.requirements ?? []).map((name) => ({ name, required: true })),
    stipendMin: job?.stipendMin?.toString() ?? "",
    stipendMax: job?.stipendMax?.toString() ?? "",
    stipendNote: job?.stipendNote ?? "",
    housing:
      job?.housingProvided === true ? "PROVIDED" : job?.housingProvided === false ? "NONE" : null,
    benefitNote: "",
    docs: (job?.requiredDocs ?? []).map((name) => ({ name, required: true })),
    processSteps: [],
    applyMethods: job?.sourceUrl ? { LINK: job.sourceUrl } : {},
    inquiry: "",
    deadline: job?.deadline ?? "",
    alwaysOpen: job ? job.deadline === null : false,
  };
}

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
function StipendFields({ draft, patch }: SectionProps) {
  const presetOptions = Object.fromEntries(STIPEND_NOTE_PRESETS.map((p) => [p, p])) as Record<
    string,
    string
  >;
  const presetValue = (STIPEND_NOTE_PRESETS as readonly string[]).includes(draft.stipendNote)
    ? draft.stipendNote
    : null;
  return (
    <Field label="월 사례비 (만원)">
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          value={draft.stipendMin}
          onChange={(e) => patch({ stipendMin: e.target.value, stipendNote: "" })}
          placeholder="최소"
          className="h-9"
        />
        <span className="text-muted-foreground">~</span>
        <Input
          inputMode="numeric"
          value={draft.stipendMax}
          onChange={(e) => patch({ stipendMax: e.target.value, stipendNote: "" })}
          placeholder="최대"
          className="h-9"
        />
      </div>
      <div className="mt-3 space-y-2">
        <ChipSelect
          options={presetOptions}
          value={presetValue}
          onChange={(v) => patch({ stipendNote: v ?? "", stipendMin: "", stipendMax: "" })}
        />
        <Input
          value={presetValue ? "" : draft.stipendNote}
          onChange={(e) => patch({ stipendNote: e.target.value, stipendMin: "", stipendMax: "" })}
          placeholder="직접 입력 (예: 사역 경력에 따라 협의)"
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
function ApplyFields({ draft, patch }: SectionProps) {
  const methods = draft.applyMethods;
  const toggle = (key: ApplyMethod) => {
    const next = { ...methods };
    if (key in next) delete next[key];
    else next[key] = "";
    patch({ applyMethods: next });
  };
  return (
    <Field label="접수 방법" required>
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
              className="h-9"
            />
          ))}
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

// 직분·부서 "기타" 선택 시 직접 입력칸 (enum에 없는 값 대비)
function EtcInput({
  show,
  value,
  onChange,
  label,
}: {
  show: boolean;
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  if (!show) return null;
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`${label} 직접 입력`}
      aria-label={`${label} 직접 입력`}
      className="mt-2 h-9"
    />
  );
}

function stepSections(
  step: number,
  draft: JobDraft,
  patch: SectionProps["patch"],
  church: Church | null,
): SectionDef[] {
  if (step === 1) {
    return [
      {
        key: "church",
        title: "교회 정보",
        description: church ? "인증된 교회 정보로 게재돼요." : undefined,
        content: church ? <ChurchSummaryCard church={church} /> : <ChurchFields />,
      },
      {
        key: "recruit",
        title: "모집 내용",
        content: (
          <>
            <Field label="공고 제목" required>
              <Input
                required
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="예) 유초등부를 함께 섬길 전도사를 청빙합니다"
                className="h-9"
              />
            </Field>
            <Field label="직분" required>
              <ChipSelect
                options={POSITIONS}
                value={draft.position}
                onChange={(v) => patch({ position: v })}
              />
              <EtcInput
                show={draft.position === "ETC"}
                value={draft.positionEtc}
                onChange={(v) => patch({ positionEtc: v })}
                label="직분"
              />
            </Field>
            <Field label="담당 부서" optional>
              <ChipSelect
                options={DEPARTMENTS}
                value={draft.department}
                onChange={(v) => patch({ department: v })}
              />
              <EtcInput
                show={draft.department === "ETC"}
                value={draft.departmentEtc}
                onChange={(v) => patch({ departmentEtc: v })}
                label="부서"
              />
            </Field>
            <Field label="고용형태" required>
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
                  className="h-9"
                />
              </Field>
              <Field label="부임 시기" optional>
                <Input
                  value={draft.startTiming}
                  onChange={(e) => patch({ startTiming: e.target.value })}
                  placeholder="예) 2026년 9월 · 협의"
                  className="h-9"
                />
              </Field>
            </div>
            <Field label="근무 요일" optional hint="파트 등 근무일이 정해진 경우에만 적어 주세요.">
              <Input
                value={draft.workDays}
                onChange={(e) => patch({ workDays: e.target.value })}
                placeholder="예) 주일·수요 / 주중 상근"
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
        description: "흔한 요건을 고르고, 필요하면 직접 추가하세요.",
        content: (
          <CheckList
            presets={QUALIFICATION_PRESETS}
            items={draft.qualifications}
            onChange={(v) => patch({ qualifications: v })}
            addPlaceholder="예) 1종 보통 운전면허 소지자"
          />
        ),
      },
      {
        key: "intro",
        title: "함께할 사역자에게",
        optional: true,
        description: "우리 교회와 사역을 자유롭게 소개해 주세요.",
        content: (
          <textarea
            value={draft.intro}
            onChange={(e) => patch({ intro: e.target.value })}
            placeholder="예) 저희 교회는 다음세대를 세우는 일에 힘쓰고 있어요. 함께 유초등부를 섬길 전도사님을 기다립니다."
            aria-label="함께할 사역자에게"
            className={TEXTAREA_CLASS}
          />
        ),
      },
    ];
  }

  if (step === 2) {
    return [
      {
        key: "stipend",
        title: "사례비 · 예우",
        content: (
          <>
            <StipendFields draft={draft} patch={patch} />
            <Field label="사택 제공">
              <ChipSelect
                options={HOUSING_OPTIONS}
                value={draft.housing}
                onChange={(v) => patch({ housing: v })}
              />
            </Field>
            <Field label="처우 비고" optional>
              <textarea
                value={draft.benefitNote}
                onChange={(e) => patch({ benefitNote: e.target.value })}
                placeholder="예) 4대보험·총회연금 50% 지원, 도서비·휴가비 별도"
                aria-label="처우 비고"
                className={TEXTAREA_CLASS}
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
        optional: true,
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
      title: "지원 방법 · 문의",
      content: (
        <>
          <ApplyFields draft={draft} patch={patch} />
          <Field
            label="문의처"
            optional
            hint="개인 담당자 휴대폰 대신 교회 대표 연락처를 권장해요(개인정보 보호)."
          >
            <Input
              value={draft.inquiry}
              onChange={(e) => patch({ inquiry: e.target.value })}
              placeholder="예) 교회 사무실 02-000-0000"
              className="h-9"
            />
          </Field>
        </>
      ),
    },
    {
      key: "deadline",
      title: "마감",
      content: <DeadlineFields draft={draft} patch={patch} />,
    },
  ];
}

// 공고 등록/수정 공유 폼 — 3스텝 위저드(모집 기본 → 처우·서류 → 지원·마감).
// mock 단계 — Phase 1에서 actions.ts Server Action(검증→저장→updateTag("jobs")) 배선.
export function JobForm({
  mode,
  church,
  initialJob,
}: {
  mode: "create" | "edit";
  church: Church | null;
  initialJob?: Job;
}) {
  const [draft, setDraft] = useState<JobDraft>(() => toDraft(initialJob));
  const [step, setStep] = useState(1);
  const [activeSec, setActiveSec] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const patch = (partial: Partial<JobDraft>) => setDraft((d) => ({ ...d, ...partial }));

  const sections = stepSections(step, draft, patch, church);

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

  const go = (n: number) => {
    setStep(Math.min(TOTAL_STEPS, Math.max(1, n)));
    setActiveSec(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-5 sm:p-6">
      <StepBar step={step} />

      <p className="mb-4 text-xs text-muted-foreground">
        <span className="text-destructive">*</span> 표시만 필수예요. 나머지는 건너뛰어도 등록돼요.
      </p>

      {/* 전부 선택인 단계(처우·서류)엔 부담 완화 안내 — 공급(교회 등록) 확보 */}
      {step === 2 && (
        <p className="mb-4 rounded-lg bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground">
          이 단계는 모두 선택이에요. 채우면 더 좋은 공고가 되지만, 비워도 바로 등록할 수 있어요.
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

      {submitted && (
        <p className="mb-3 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          {mode === "create" ? "등록" : "저장"} 기능은 준비 중이에요. 서비스 오픈과 함께 열릴게요.
        </p>
      )}

      <div className="flex gap-2.5">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12"
            onClick={() => go(step - 1)}
          >
            ← 이전
          </Button>
        )}
        {step < TOTAL_STEPS ? (
          <Button type="button" size="lg" className="h-12 flex-1" onClick={() => go(step + 1)}>
            다음 →
          </Button>
        ) : (
          <Button type="submit" size="lg" className="h-12 flex-1">
            {mode === "create" ? "공고 등록" : "수정 내용 저장"}
          </Button>
        )}
      </div>
      {mode === "create" && step === TOTAL_STEPS && (
        <p className="mt-2.5 text-center text-xs text-muted-foreground">
          신규 교회의 첫 공고는 운영자 검수 후 게재돼요. 등록은 무료입니다.
        </p>
      )}
    </form>
  );
}
