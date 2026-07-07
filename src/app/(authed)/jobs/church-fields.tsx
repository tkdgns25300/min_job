"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "./form-section";
import { churchMetaLine } from "@/lib/format";
import { CHURCH_CHANNELS, DENOMINATIONS, REGIONS } from "@/constants/domain";
import type { Church } from "@/types/domain";

// 네이티브 select — shadcn Input과 같은 시각 문법 (별도 select 컴포넌트 미도입 상태)
const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

interface ChurchDraft {
  name: string;
  denomination: string;
  region: string;
  city: string;
  foundedYear: string;
  channels: Record<string, string>;
}

const EMPTY_DRAFT: ChurchDraft = {
  name: "",
  denomination: "",
  region: "",
  city: "",
  foundedYear: "",
  channels: {},
};

// 재등록 교회 — 저장된 교회 정보 요약 카드 (fable.md /jobs/new §2)
export function ChurchSummaryCard({ church }: { church: Church }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
        {church.name.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{church.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{churchMetaLine(church)}</p>
      </div>
      {/* 교회 정보 수정 화면은 스코프 밖(별도 /admin/churches 안 만듦) — 당분간 문의로 */}
      <a
        href="mailto:contact@minjob.kr?subject=교회 정보 수정 요청"
        className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        정보 수정 문의
      </a>
    </div>
  );
}

// 첫 등록 교회 정보 입력 — 교단은 enum 드롭다운(자유입력 금지: 이단 1차 차단, ROADMAP 1-4).
// mock 단계라 값은 이 컴포넌트 안에만 머문다(제출 배선은 Phase 1 Server Action).
export function ChurchFields() {
  const [draft, setDraft] = useState<ChurchDraft>(EMPTY_DRAFT);
  const patch = (partial: Partial<ChurchDraft>) => setDraft((d) => ({ ...d, ...partial }));

  return (
    <div className="space-y-4">
      <Field label="교회명">
        <Input
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="예) 새소망교회"
          className="h-9"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="교단">
          <select
            aria-label="교단"
            className={SELECT_CLASS}
            value={draft.denomination}
            onChange={(e) => patch({ denomination: e.target.value })}
          >
            <option value="">선택</option>
            {Object.entries(DENOMINATIONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="지역">
          <select
            aria-label="지역"
            className={SELECT_CLASS}
            value={draft.region}
            onChange={(e) => patch({ region: e.target.value })}
          >
            <option value="">선택</option>
            {Object.entries(REGIONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="시·군·구" optional>
          <Input
            value={draft.city}
            onChange={(e) => patch({ city: e.target.value })}
            placeholder="예) 성남"
            className="h-9"
          />
        </Field>
        <Field label="창립연도" optional>
          <Input
            inputMode="numeric"
            value={draft.foundedYear}
            onChange={(e) => patch({ foundedYear: e.target.value })}
            placeholder="예) 1995"
            className="h-9"
          />
        </Field>
      </div>

      <Field
        label="교회 채널"
        optional
        hint="홈페이지·유튜브 등 교회 공개 채널 주소만 적어 주세요."
      >
        <div className="space-y-2">
          {Object.entries(CHURCH_CHANNELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
              <Input
                type="url"
                value={draft.channels[key] ?? ""}
                onChange={(e) => patch({ channels: { ...draft.channels, [key]: e.target.value } })}
                placeholder="https://"
                className="h-9"
              />
            </div>
          ))}
        </div>
      </Field>
    </div>
  );
}
