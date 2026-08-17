"use client";

import { useState, type ReactNode } from "react";
import { ChipMultiSelect } from "@/components/job/chip-select";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { structureJobText, type IngestDraft } from "@/lib/ingest/structure";
import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  POSITIONS,
  REGIONS,
} from "@/constants/domain";
import type { ChurchOption } from "@/types/domain";

const SOURCE_PLACEHOLDER = `예)
○○교회 부목사 청빙
- 교단: 예장합동 / 지역: 경기 용인
- 담당: 유초등부 / 전임
- 사례비: 월 250만원 (사택 제공)
- 마감: 2026-09-30
- 문의: 교회 사무실`;

// 수집 도구 — 원문 붙여넣기(좌) → AI 구조화(mock) → 검토·보정(우) → '운영자 등록'(mock no-op).
export function IngestView({ churchOptions }: { churchOptions: ChurchOption[] }) {
  const [raw, setRaw] = useState("");
  const [draft, setDraft] = useState<IngestDraft | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const patch = (partial: Partial<IngestDraft>) => {
    setDraft((d) => (d ? { ...d, ...partial } : d));
    setSubmitted(false); // 등록 후 필드를 고치면 'Phase 1' 안내가 남지 않게 초기화
  };

  const structure = () => {
    // mock: client에서 sync 호출. Phase 1엔 Server Action(async, Claude API)으로 전환.
    setDraft(structureJobText(raw));
    setSubmitted(false);
  };
  const reset = () => {
    setRaw("");
    setDraft(null);
    setSubmitted(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SourcePanel
        raw={raw}
        onChange={setRaw}
        onStructure={structure}
        onReset={reset}
        canReset={raw !== "" || draft !== null}
      />
      <DraftPanel
        draft={draft}
        patch={patch}
        churchOptions={churchOptions}
        submitted={submitted}
        onSubmit={() => setSubmitted(true)}
      />
    </div>
  );
}

function SourcePanel({
  raw,
  onChange,
  onStructure,
  onReset,
  canReset,
}: {
  raw: string;
  onChange: (v: string) => void;
  onStructure: () => void;
  onReset: () => void;
  canReset: boolean;
}) {
  return (
    <section className="flex flex-col rounded-2xl border bg-card p-5">
      <h2 className="text-sm font-bold">원문 붙여넣기</h2>
      <p className="mt-1 text-xs break-keep text-muted-foreground">
        교단·신학교 게시판이나 공문에서 <b>사람이 직접 확보한</b> 공고 원문을 붙여넣으세요. 자동
        수집이 아니에요.
      </p>
      <Textarea
        className="mt-3 min-h-72 flex-1"
        placeholder={SOURCE_PLACEHOLDER}
        value={raw}
        onChange={(e) => onChange(e.target.value)}
        aria-label="공고 원문"
      />
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" onClick={onStructure} disabled={!raw.trim()}>
          <Sparkles className="size-4" />
          AI 구조화
        </Button>
        <Button variant="outline" onClick={onReset} disabled={!canReset}>
          초기화
        </Button>
      </div>
    </section>
  );
}

function DraftPanel({
  draft,
  patch,
  churchOptions,
  submitted,
  onSubmit,
}: {
  draft: IngestDraft | null;
  patch: (partial: Partial<IngestDraft>) => void;
  churchOptions: ChurchOption[];
  submitted: boolean;
  onSubmit: () => void;
}) {
  if (!draft) {
    return (
      <section className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed bg-card/50 p-6">
        <p className="max-w-xs text-center text-sm break-keep text-muted-foreground">
          왼쪽에 원문을 붙여넣고 <b className="text-foreground">AI 구조화</b>를 누르면 여기에 공고
          필드가 채워져요.
        </p>
      </section>
    );
  }

  const matched = churchOptions.find((c) => c.name === draft.churchName.trim());

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="text-sm font-bold">구조화 결과 · 검토</h2>
      <p className="mt-1 text-xs break-keep text-muted-foreground">
        AI 추정값이에요. 빈 칸·잘못된 항목을 보정한 뒤 등록하세요.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <Field label="공고 제목">
          <Input
            className="h-9"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            aria-label="공고 제목"
          />
        </Field>

        <Field label="교회">
          <Input
            className="h-9"
            list="ingest-church-options"
            value={draft.churchName}
            onChange={(e) => patch({ churchName: e.target.value })}
            placeholder="교회명 입력·검색"
            aria-label="교회명"
          />
          {/* 운영자 화면이라 미상을 숨기지 않는다 — 검수에서 채워야 할 값이다(DATA §3) */}
          <p className="text-xs text-muted-foreground">
            {matched ? (
              <span className="text-primary">
                기존 교회 연결 ·{" "}
                {matched.denomination ? DENOMINATIONS[matched.denomination] : "교단 미상"}{" "}
                {matched.region ? REGIONS[matched.region] : "지역 미상"}
              </span>
            ) : draft.churchName.trim() ? (
              <span className="text-gold-ink">신규 교회로 생성</span>
            ) : (
              "교회명을 입력하면 기존 교회와 매칭돼요."
            )}
          </p>
        </Field>

        {/* 지도가 쓰는 값이라 **접수처를 넣으면 안 된다**(DATA §3).
            시·군·구는 표기가 제각각이라 구조화가 못 잡는다 — 여기서 채운다 */}
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Field label="시·군·구">
            <Input
              aria-label="시·군·구"
              value={draft.city}
              onChange={(e) => patch({ city: e.target.value })}
              placeholder="예) 수원"
              className="h-9"
            />
          </Field>
          <Field label="주소">
            <Input
              aria-label="주소"
              value={draft.address}
              onChange={(e) => patch({ address: e.target.value })}
              placeholder="교회 위치 (접수처 아님)"
              className="h-9"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="교단">
            <EnumSelect
              labels={DENOMINATIONS}
              value={draft.denomination}
              onChange={(v) => patch({ denomination: v })}
              placeholder="교단 선택"
            />
          </Field>
          <Field label="지역">
            <EnumSelect
              labels={REGIONS}
              value={draft.region}
              onChange={(v) => patch({ region: v })}
              placeholder="지역 선택"
            />
          </Field>
          <Field label="직분">
            <ChipMultiSelect
              options={POSITIONS}
              value={draft.position}
              onChange={(v) => patch({ position: v })}
            />
          </Field>
          <Field label="담당 부서">
            <EnumSelect
              labels={DEPARTMENTS}
              value={draft.department}
              onChange={(v) => patch({ department: v })}
              placeholder="부서 선택"
            />
          </Field>
        </div>

        <Field label="고용형태">
          <EnumSelect
            labels={EMPLOYMENT_TYPES}
            value={draft.employmentType}
            onChange={(v) => patch({ employmentType: v })}
            placeholder="고용형태 선택"
          />
        </Field>

        <Field label="월 사례비 (만원)">
          <div className="flex items-center gap-2">
            <Input
              className="h-9"
              inputMode="numeric"
              placeholder="최소"
              value={draft.payMin}
              onChange={(e) => patch({ payMin: e.target.value, payNote: "" })}
              aria-label="사례비 최소"
            />
            <span className="text-muted-foreground">~</span>
            <Input
              className="h-9"
              inputMode="numeric"
              placeholder="최대"
              value={draft.payMax}
              onChange={(e) => patch({ payMax: e.target.value, payNote: "" })}
              aria-label="사례비 최대"
            />
          </div>
          <Input
            className="mt-2 h-9"
            placeholder="또는 비정형 (예: 교회 내규에 따름)"
            value={draft.payNote}
            onChange={(e) => patch({ payNote: e.target.value, payMin: "", payMax: "" })}
            aria-label="사례비 비정형 표현"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="마감일">
            <Input
              className="h-9"
              type="date"
              value={draft.deadline}
              onChange={(e) => patch({ deadline: e.target.value })}
              aria-label="마감일"
            />
          </Field>
          <Field label="원문 링크">
            <Input
              className="h-9"
              type="url"
              placeholder="https://"
              value={draft.sourceUrl}
              onChange={(e) => patch({ sourceUrl: e.target.value })}
              aria-label="원문 링크"
            />
          </Field>
        </div>

        <Field label="본문·메모">
          <Textarea
            className="min-h-28"
            value={draft.body}
            onChange={(e) => patch({ body: e.target.value })}
            aria-label="본문·메모"
          />
        </Field>
      </div>

      {submitted && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          등록 처리(저장 + 태그 무효화)는 준비 중이에요. 지금은 미리보기예요.
        </p>
      )}

      <Button className="mt-4 w-full" onClick={onSubmit}>
        운영자 등록
      </Button>
      <p className="mt-2 text-center text-xs break-keep text-muted-foreground">
        ‘운영자 등록’(소유자 없음)으로 저장돼요. 교회는 나중에 이 공고를 클레임할 수 있어요.
      </p>

      <datalist id="ingest-church-options">
        {churchOptions.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// 도메인 enum select — value=null이면 placeholder 옵션 선택. 빈 값 선택 시 null로 되돌림.
function EnumSelect<K extends string>({
  labels,
  value,
  onChange,
  placeholder,
}: {
  labels: Record<K, string>;
  value: K | null;
  onChange: (v: K | null) => void;
  placeholder: string;
}) {
  return (
    <NativeSelect
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || null) as K | null)}
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {(Object.entries(labels) as [K, string][]).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </NativeSelect>
  );
}
