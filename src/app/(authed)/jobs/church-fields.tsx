"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/field";
import { churchMetaLine } from "@/lib/format";
import { CHURCH_CHANNELS, DENOMINATIONS, REGIONS } from "@/constants/domain";
import { contactMailto } from "@/constants/business";
import type { Church } from "@/types/domain";

interface ChurchDraft {
  name: string;
  denomination: string;
  region: string;
  city: string;
  address: string;
  foundedYear: string;
  channels: Record<string, string>;
}

const EMPTY_DRAFT: ChurchDraft = {
  name: "",
  denomination: "",
  region: "",
  city: "",
  address: "",
  foundedYear: "",
  channels: {},
};

// 재등록 교회 — 저장된 교회 정보 요약 카드 (SPEC.md /jobs/new §2)
export function ChurchSummaryCard({ church }: { church: Church }) {
  // 교단·지역이 전부 미상이면 ""라 빈 <p>가 여백만 차지한다
  const meta = churchMetaLine(church);
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
      {/* 교회 로고/아바타 데이터 없음 — 이니셜 플레이스홀더 대신 이름·메타만 표시 */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{church.name}</p>
        {meta && <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>}
      </div>
      {/* 교회 정보 수정 화면은 스코프 밖(별도 /admin/churches 안 만듦) — 당분간 문의로 */}
      <a
        href={contactMailto("교회 정보 수정 요청")}
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
          <NativeSelect
            aria-label="교단"
            value={draft.denomination}
            onChange={(e) => patch({ denomination: e.target.value })}
          >
            <option value="">선택</option>
            {Object.entries(DENOMINATIONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="지역">
          <NativeSelect
            aria-label="지역"
            value={draft.region}
            onChange={(e) => patch({ region: e.target.value })}
          >
            <option value="">선택</option>
            {Object.entries(REGIONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </NativeSelect>
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

      {/* 주소는 길어서 전폭 한 줄. 있으면 지도가 정확해진다 — 없으면 교회명+지역 검색이라 동명 교회를 짚는다 */}
      <Field label="주소" optional>
        <Input
          value={draft.address}
          onChange={(e) => patch({ address: e.target.value })}
          placeholder="예) 경기 성남시 분당구 …"
          className="h-9"
        />
      </Field>

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
