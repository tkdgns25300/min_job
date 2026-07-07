"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection, Field } from "./form-section";
import { ChipSelect } from "./chip-select";
import { ListField } from "./list-field";
import { ChurchFields, ChurchSummaryCard } from "./church-fields";
import {
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  POSITIONS,
  REQUIRED_DOC_PRESETS,
  STIPEND_NOTE_PRESETS,
  type Department,
  type EmploymentType,
  type Position,
} from "@/constants/domain";
import type { Church, Job } from "@/types/domain";

// textarea — shadcn Input과 같은 시각 문법 (별도 textarea 컴포넌트 미도입 상태)
const TEXTAREA_CLASS =
  "min-h-36 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

interface JobDraft {
  title: string;
  position: Position | null;
  department: Department | null;
  employmentType: EmploymentType | null;
  workDays: string;
  stipendMin: string;
  stipendMax: string;
  stipendNote: string;
  requirements: string[];
  preferred: string[];
  requiredDocs: string[];
  description: string;
  deadline: string;
  alwaysOpen: boolean;
  applyUrl: string;
}

function toDraft(job?: Job): JobDraft {
  return {
    title: job?.title ?? "",
    position: job?.position ?? null,
    department: job?.department ?? null,
    employmentType: job?.employmentType ?? null,
    workDays: job?.workDays ?? "",
    stipendMin: job?.stipendMin?.toString() ?? "",
    stipendMax: job?.stipendMax?.toString() ?? "",
    stipendNote: job?.stipendNote ?? "",
    requirements: job?.requirements ?? [],
    preferred: job?.preferred ?? [],
    requiredDocs: job?.requiredDocs ?? [],
    description: job?.description ?? "",
    deadline: job?.deadline ?? "",
    alwaysOpen: job ? job.deadline === null : false,
    // Job 타입에 지원 링크 필드 없음(스키마 미확정) — 아래 지원 안내 링크 섹션 TODO 참조
    applyUrl: "",
  };
}

interface SectionProps {
  draft: JobDraft;
  patch: (partial: Partial<JobDraft>) => void;
}

// 사례비 — 숫자(min·max)와 비정형(내규·협의)을 동급 경로로 (인터뷰: 대부분 비공개).
// 프리셋 칩·직접 입력을 쓰면 숫자를 비우고, 숫자를 쓰면 비정형을 비운다 — 한쪽만 저장.
function StipendFields({ draft, patch }: SectionProps) {
  const presetOptions = Object.fromEntries(STIPEND_NOTE_PRESETS.map((p) => [p, p])) as Record<
    string,
    string
  >;
  const presetValue = (STIPEND_NOTE_PRESETS as readonly string[]).includes(draft.stipendNote)
    ? draft.stipendNote
    : null;

  return (
    <div className="space-y-4">
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
      </Field>
      <Field label="또는 협의로" hint="선택하면 숫자 대신 이 표현이 공고에 그대로 노출돼요.">
        <div className="space-y-2">
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
      </Field>
    </div>
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
        상시모집 — 사역자를 구할 때까지
      </label>
      {/* 자동 만료 정책은 운영 규칙(ROADMAP 1-7) — 폼에선 고지 한 줄만 */}
      <p className="text-xs text-muted-foreground">오래된 공고는 확인 후 정리될 수 있어요.</p>
    </div>
  );
}

function SubmitBlock({ mode, submitted }: { mode: "create" | "edit"; submitted: boolean }) {
  return (
    <div className="mt-6 space-y-3 border-t pt-6">
      {submitted && (
        <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          {mode === "create" ? "등록" : "저장"} 기능은 준비 중이에요. 서비스 오픈과 함께 열릴게요.
        </p>
      )}
      <Button type="submit" size="lg" className="h-11 w-full">
        {mode === "create" ? "공고 등록" : "수정 내용 저장"}
      </Button>
      {mode === "create" && (
        <p className="text-center text-xs text-muted-foreground">
          첫 공고는 확인(검수) 후 게재돼요.
        </p>
      )}
    </div>
  );
}

// 공고 등록/수정 공유 폼 — 신규/수정은 초기값과 제출 카피만 다름 (fable.md /jobs/[id]/edit §2).
// 한 페이지 스크롤 폼(스텝 위저드 X — 1인 운영 단순성).
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
  const [submitted, setSubmitted] = useState(false);
  const patch = (partial: Partial<JobDraft>) => setDraft((d) => ({ ...d, ...partial }));

  // mock 단계 — Phase 1에서 actions.ts Server Action(검증→저장→updateTag("jobs")) 배선.
  // 필수 미입력 인라인 에러·min>max 검증·성공 시 상세 redirect도 그때 함께.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-5 sm:p-6">
      <FormSection
        title="교회 정보"
        description={church ? "등록된 교회 정보로 게재돼요." : undefined}
      >
        {church ? <ChurchSummaryCard church={church} /> : <ChurchFields />}
      </FormSection>

      <FormSection title="모집 내용">
        <Field label="공고 제목">
          <Input
            required
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="예) 유초등부를 함께 섬길 전도사를 청빙합니다"
            className="h-9"
          />
        </Field>
        <Field label="직분">
          <ChipSelect
            options={POSITIONS}
            value={draft.position}
            onChange={(v) => patch({ position: v })}
          />
        </Field>
        {/* TODO(design): ❓ 부서 복수 선택 — 부서 재설계(세분화+교단별 별칭, ROADMAP 1-7)
            확정 전까지 단일 선택으로 유지 (fable.md #9) */}
        <Field label="담당 부서" optional>
          <ChipSelect
            options={DEPARTMENTS}
            value={draft.department}
            onChange={(v) => patch({ department: v })}
          />
        </Field>
        <Field label="고용형태">
          <ChipSelect
            options={EMPLOYMENT_TYPES}
            value={draft.employmentType}
            onChange={(v) => patch({ employmentType: v })}
          />
        </Field>
        <Field label="출근" optional>
          <Input
            value={draft.workDays}
            onChange={(e) => patch({ workDays: e.target.value })}
            placeholder="주일·수요 등"
            className="h-9"
          />
        </Field>
      </FormSection>

      <FormSection title="사례비">
        <StipendFields draft={draft} patch={patch} />
      </FormSection>

      <FormSection title="자격 요건">
        <ListField
          items={draft.requirements}
          onChange={(v) => patch({ requirements: v })}
          placeholder="예) 신학대학원 재학 이상"
        />
      </FormSection>

      <FormSection title="우대 사항">
        <ListField
          items={draft.preferred}
          onChange={(v) => patch({ preferred: v })}
          placeholder="예) 유초등부 사역 경험자"
        />
      </FormSection>

      <FormSection title="제출 서류">
        <ListField
          items={draft.requiredDocs}
          onChange={(v) => patch({ requiredDocs: v })}
          presets={REQUIRED_DOC_PRESETS}
          placeholder="직접 추가"
        />
      </FormSection>

      <FormSection title="공고 안내">
        <textarea
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="모집 배경, 사역 내용, 교회 소개 등을 적어 주세요."
          aria-label="공고 안내"
          className={TEXTAREA_CLASS}
        />
      </FormSection>

      <FormSection title="마감">
        <DeadlineFields draft={draft} patch={patch} />
      </FormSection>

      <FormSection title="지원 안내 링크">
        {/* 가드레일 #3: 개인 담당자 연락처 입력란은 두지 않는다 — 교회 공개 링크만 받는다 */}
        {/* TODO(design): ❓ 교회 대표 전화/이메일(공개 연락처) 필드 신설 여부 —
            가드레일 #3 안에서 허용 범위지만 Job 타입에 없음, DATA 확정 필요 (fable.md #9) */}
        <Field
          label="지원 안내 URL"
          optional
          hint="교회 공개 링크(홈페이지·게시판)만 적어 주세요. 개인 연락처(휴대폰 번호 등)는 적지 마세요."
        >
          <Input
            type="url"
            value={draft.applyUrl}
            onChange={(e) => patch({ applyUrl: e.target.value })}
            placeholder="https:// 교회 홈페이지·게시판 주소"
            className="h-9"
          />
        </Field>
      </FormSection>

      <SubmitBlock mode={mode} submitted={submitted} />
    </form>
  );
}
