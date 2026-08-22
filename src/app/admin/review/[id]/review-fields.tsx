"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/field";
import { ChipMultiSelect, ChipSelect } from "@/components/job/chip-select";
import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  JOB_KINDS,
  PAY_PERIODS,
  POSITIONS,
  REGIONS,
  type JobKind,
} from "@/constants/domain";
import { DENOMINATION_SOURCES } from "@/constants/review";
import { keyOf } from "@/lib/domain-enum";
import { denominationChoice, type ReviewEdits } from "@/lib/review-edits";
import { isDenominationPublished } from "@/lib/review-flags";

// 고칠 수 있는 칸들. 짝 규칙(종류↔직분·직무, 교단↔근거)은 **컨트롤이 스스로 맞춘다** —
// 그래야 저장이 막히는 상태를 만들 수 없다. 규칙 자체는 lib/review-edits.ts가 정본이다.

export interface EditProps {
  draft: ReviewEdits;
  patch: (partial: Partial<ReviewEdits>) => void;
}

export interface FieldsProps extends EditProps {
  /** 저장된 값 — 교단 판정 근거는 "손댔는가"로 정해지므로 원래 값을 알아야 한다 */
  original: ReviewEdits;
}

/** 사택은 `boolean | null` 세 상태다 — **null은 "미제공"이 아니라 "원문이 말하지 않음"**이고 그대로 공개된다 */
const HOUSING_CHOICES = { PROVIDED: "제공", NONE: "없음", UNSAID: "말하지 않음" } as const;
type HousingChoice = keyof typeof HOUSING_CHOICES;

/**
 * 순서는 `APPLY_METHODS`(constants/domain)와 같게 — 표시 순서의 단일 소스가 그쪽이다.
 * ⚠️ 키를 **이 네 컬럼으로 못 박는다**(`keyof ReviewEdits`가 아니다). 아래 `patch({ [key]: 문자열 })`은
 *    계산된 키라 타입 검사가 느슨해서, 숫자 칸(`pay_min`)을 이 배열에 넣으면 문자열이 그대로 들어간다.
 */
type ContactKey = "contact_link" | "contact_email" | "contact_post" | "contact_tel";

const CONTACT_FIELDS: { key: ContactKey; label: string; placeholder: string }[] = [
  { key: "contact_link", label: "접수 링크", placeholder: "홈페이지·양식 URL" },
  { key: "contact_email", label: "접수 이메일", placeholder: "recruit@church.org" },
  { key: "contact_post", label: "접수 주소", placeholder: "○○교회 청빙위원장 귀하" },
  { key: "contact_tel", label: "접수 전화", placeholder: "02-000-0000" },
];

export function ReviewFields({ draft, patch, original }: FieldsProps) {
  return (
    <div className="space-y-4">
      <IdentityFields draft={draft} patch={patch} />
      <SeatFields draft={draft} patch={patch} />
      <PlaceFields draft={draft} patch={patch} original={original} />
      <ConditionFields draft={draft} patch={patch} />
      <ContactFields draft={draft} patch={patch} />
      <DescriptionFields draft={draft} patch={patch} />
    </div>
  );
}

function IdentityFields({ draft, patch }: EditProps) {
  return (
    <>
      <Field label="교회명" required>
        <Input
          className="h-9"
          value={draft.church_name ?? ""}
          onChange={(e) => patch({ church_name: e.target.value })}
        />
      </Field>
      <Field label="제목" required hint="게시판 접두(공고·모집 등)는 크롤러가 걷어냅니다">
        <Input
          className="h-9"
          value={draft.title ?? ""}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </Field>
    </>
  );
}

function SeatFields({ draft, patch }: EditProps) {
  const ministry = draft.job_kind.includes("MINISTRY");
  const general = draft.job_kind.includes("GENERAL");

  // 종류를 빼면 짝이 되는 칸도 함께 비운다 — 한쪽만 남으면 DB CHECK가 저장을 막는다
  const pickKinds = (next: JobKind[]) =>
    patch({
      job_kind: next,
      position: next.includes("MINISTRY") ? draft.position : [],
      role: next.includes("GENERAL") ? draft.role : null,
    });

  return (
    <>
      <Field
        label="종류"
        required
        group
        hint="사역직에는 직분이, 일반직에는 직무명이 반드시 짝으로 있어야 저장됩니다"
      >
        <ChipMultiSelect options={JOB_KINDS} value={draft.job_kind} onChange={pickKinds} />
      </Field>
      {ministry && (
        <Field label="직분" required group>
          <ChipMultiSelect
            options={POSITIONS}
            value={draft.position}
            onChange={(position) => patch({ position })}
          />
        </Field>
      )}
      {general && (
        <Field label="직무명" required>
          <Input
            className="h-9"
            placeholder="예: 사무간사, 차량운행"
            value={draft.role ?? ""}
            onChange={(e) => patch({ role: e.target.value })}
          />
        </Field>
      )}
      <Field
        label="부서"
        optional
        group
        hint="크롤 공고의 69%가 비어 있습니다 — 없는 게 정상입니다"
      >
        <ChipSelect
          options={DEPARTMENTS}
          value={draft.department}
          onChange={(department) => patch({ department })}
        />
      </Field>
    </>
  );
}

function PlaceFields({ draft, patch, original }: FieldsProps) {
  const source = DENOMINATION_SOURCES[draft.denomination_source];
  const published = isDenominationPublished(draft.denomination_source);

  return (
    <>
      <Field
        label="지역"
        group
        hint="코드는 근거가 원문에 있는지만 봅니다 — 지역은 항상 눈으로 확인해 주세요. 비면 지역 검색에 걸리지 않습니다"
      >
        <div className="flex gap-2">
          <NativeSelect
            aria-label="광역 지역"
            className="w-32 shrink-0"
            value={draft.region ?? ""}
            onChange={(e) => patch({ region: keyOf(REGIONS, e.target.value) })}
          >
            <option value="">지역 미상</option>
            {Object.entries(REGIONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <Input
            className="h-9"
            aria-label="시·군·구"
            placeholder="시·군·구"
            value={draft.city ?? ""}
            onChange={(e) => patch({ city: e.target.value })}
          />
        </div>
      </Field>

      <Field
        label="교단"
        hint={
          published
            ? `근거 ${source}`
            : `근거 ${source} — 이대로면 교단이 공개되지 않습니다. 고치면 "사람이 확정"으로 바뀝니다`
        }
      >
        <NativeSelect
          value={draft.denomination ?? ""}
          onChange={(e) =>
            patch(denominationChoice(keyOf(DENOMINATIONS, e.target.value), original))
          }
        >
          <option value="">미상</option>
          {Object.entries(DENOMINATIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </>
  );
}

function ConditionFields({ draft, patch }: EditProps) {
  const housing: HousingChoice =
    draft.housing_provided === true
      ? "PROVIDED"
      : draft.housing_provided === false
        ? "NONE"
        : "UNSAID";

  return (
    <>
      <Field label="고용형태" group>
        <ChipSelect
          options={EMPLOYMENT_TYPES}
          value={draft.employment_type}
          onChange={(employment_type) => patch({ employment_type })}
        />
      </Field>

      <Field label="사택" group hint="“말하지 않음”은 “없음”과 다른 값입니다 — 그대로 공개됩니다">
        <ChipSelect
          options={HOUSING_CHOICES}
          value={housing}
          onChange={(choice) => {
            // 재클릭 해제를 **무시한다** — 세 칩이 세 상태를 다 덮으므로, 해제를 null로 받으면
            // "제공"을 다시 누른 것이 "말하지 않음"을 몰래 고른 것이 된다(그대로 공개되는 값이다).
            if (!choice) return;
            patch({
              housing_provided: choice === "PROVIDED" ? true : choice === "NONE" ? false : null,
            });
          }}
        />
        <Input
          className="mt-2 h-9"
          aria-label="사택 비정형 표현"
          placeholder="원문 표현 (예: 사택 협의)"
          value={draft.housing_note ?? ""}
          onChange={(e) => patch({ housing_note: e.target.value })}
        />
      </Field>

      <Field
        label="사례비 (만원)"
        group
        hint="주기를 정할 수 없으면 금액도 비웁니다 — 주기 없이 내보내면 연봉이 월급으로 공개됩니다"
      >
        <ChipSelect
          options={PAY_PERIODS}
          value={draft.pay_period}
          onChange={(pay_period) => patch({ pay_period })}
        />
        <div className="mt-2 flex items-center gap-2">
          <Input
            className="h-9"
            inputMode="numeric"
            aria-label="사례비 최소"
            placeholder="최소"
            value={draft.pay_min ?? ""}
            onChange={(e) => patch({ pay_min: parseAmount(e.target.value) })}
          />
          <span className="text-muted-foreground">~</span>
          <Input
            className="h-9"
            inputMode="numeric"
            aria-label="사례비 최대"
            placeholder="최대"
            value={draft.pay_max ?? ""}
            onChange={(e) => patch({ pay_max: parseAmount(e.target.value) })}
          />
        </div>
        <Input
          className="mt-2 h-9"
          aria-label="사례비 비정형 표현"
          placeholder="비정형 표현 (예: 교회 내규에 따름)"
          value={draft.pay_note ?? ""}
          onChange={(e) => patch({ pay_note: e.target.value })}
        />
      </Field>

      <Field label="마감일" hint="비우면 상시모집 — 게시일부터 90일까지만 목록에 뜹니다">
        <Input
          className="h-9"
          type="date"
          value={draft.deadline ?? ""}
          onChange={(e) => patch({ deadline: e.target.value || null })}
        />
      </Field>
    </>
  );
}

function ContactFields({ draft, patch }: EditProps) {
  return (
    <Field
      label="연락처"
      required
      group
      hint="넷 중 하나는 있어야 공개됩니다. 접수 주소는 원문 대조를 거치지 않은 조립 값이라 특히 확인이 필요합니다"
    >
      <div className="space-y-2">
        {CONTACT_FIELDS.map(({ key, label, placeholder }) => (
          <Input
            key={key}
            className="h-9"
            aria-label={label}
            placeholder={`${label} — ${placeholder}`}
            value={draft[key] ?? ""}
            onChange={(e) => patch({ [key]: e.target.value })}
          />
        ))}
      </div>
    </Field>
  );
}

function DescriptionFields({ draft, patch }: EditProps) {
  return (
    <Field
      label="설명"
      required
      hint="AI가 쓴 요약입니다. 원문을 그대로 옮기지 마세요 — 요약 + 출처 링크가 우리 방어선입니다(가드레일 #1)"
    >
      <Textarea
        rows={5}
        value={draft.description ?? ""}
        onChange={(e) => patch({ description: e.target.value })}
      />
    </Field>
  );
}

/** 숫자만 남긴다 — 빈 칸은 `0`이 아니라 `null`(값 없음)이어야 한다 */
function parseAmount(value: string): number | null {
  const only = value.replace(/[^0-9]/g, "");
  return only === "" ? null : Number(only);
}
