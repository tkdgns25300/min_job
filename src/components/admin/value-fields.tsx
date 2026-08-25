"use client";

import { Input } from "@/components/ui/input";
import { ChipSelect } from "@/components/job/chip-select";
import { Empty } from "@/components/admin/value-row";

// 운영자 값 화면 두 곳(수집 검수 · 공고 관리)이 **글자까지 똑같이** 쓰던 칸들.
//
// 각자 정의해 두었더니 사택 3상태와 연락처 4칸이 두 파일에 복사돼 있었다 — 표시 규칙이 바뀔 때 한쪽만
// 고쳐질 자리다(운영자 화면 최종 검수 2026-08-24에서 잡았다). 여기로 모으면서 **초안 타입을 받지
// 않게** 바꿨다: 필요한 값만 받으므로 `ReviewEdits`·`JobEdits` 어느 쪽에서도 쓰이고, 컬럼 키가
// 타입으로 고정돼 예전의 계산된 키(`patch({ [key]: ... })`) 느슨함도 사라졌다.
//
// ⚠️ 금액 표시(`PayValue`)는 여기 없다 — 두 화면이 **다르게** 보여줘야 한다: `review_data.pay_period`는
//    nullable이라 "주기 없음 → 월급으로 공개됩니다" 경고가 필요하지만 `jobs.pay_period`는 NOT NULL이다.

/** 사택은 `boolean | null` 세 상태다 — **null은 "미제공"이 아니라 "공고가 말하지 않음"**이다 */
const HOUSING_CHOICES = { PROVIDED: "제공", NONE: "없음", UNSAID: "말하지 않음" } as const;
type HousingChoice = keyof typeof HOUSING_CHOICES;

function housingChoice(provided: boolean | null): HousingChoice {
  return provided === true ? "PROVIDED" : provided === false ? "NONE" : "UNSAID";
}

/** 사택 값 한 줄 — 세 상태 + 원문 표현 */
export function HousingValue({
  provided,
  note,
}: {
  provided: boolean | null;
  note: string | null;
}) {
  return (
    <>
      {HOUSING_CHOICES[housingChoice(provided)]}
      {note && <span className="text-muted-foreground"> · {note}</span>}
    </>
  );
}

/** 사택 편집 — 칩 셋 + 원문 표현 */
export function HousingFields({
  provided,
  note,
  onProvided,
  onNote,
}: {
  provided: boolean | null;
  note: string | null;
  onProvided: (next: boolean | null) => void;
  onNote: (next: string) => void;
}) {
  return (
    <>
      <ChipSelect
        options={HOUSING_CHOICES}
        value={housingChoice(provided)}
        onChange={(choice) => {
          // 재클릭 해제를 **무시한다** — 세 칩이 세 상태를 다 덮으므로, 해제를 null로 받으면
          // "제공"을 다시 누른 것이 "말하지 않음"을 몰래 고른 것이 된다(그대로 공개되는 값이다).
          if (!choice) return;
          onProvided(choice === "PROVIDED" ? true : choice === "NONE" ? false : null);
        }}
      />
      <Input
        className="mt-2 h-9"
        aria-label="사택 비정형 표현"
        placeholder="원문 표현 (예: 사택 협의)"
        value={note ?? ""}
        onChange={(e) => onNote(e.target.value)}
      />
    </>
  );
}

/** 지원 연락처 네 칸 — 두 화면이 같은 컬럼을 같은 순서로 다룬다 */
export interface ContactValues {
  contact_email: string | null;
  contact_tel: string | null;
  contact_link: string | null;
  contact_post: string | null;
}

/**
 * 순서는 `APPLY_METHODS`(constants/domain)의 정의 순서와 같게 — 링크 > 이메일 > 우편 > 전화.
 * ⚠️ 라벨은 그쪽 것을 쓰지 않는다: 공개 화면은 "이메일"이면 되지만 편집 화면에서는 **어디로 접수되는
 *    칸인지**가 드러나야 해서 "접수 이메일"로 쓴다.
 */
const CONTACT_FIELDS: { key: keyof ContactValues; label: string; placeholder: string }[] = [
  { key: "contact_link", label: "접수 링크", placeholder: "홈페이지·양식 URL" },
  { key: "contact_email", label: "접수 이메일", placeholder: "recruit@church.org" },
  { key: "contact_post", label: "접수 주소", placeholder: "○○교회 청빙위원장 귀하" },
  { key: "contact_tel", label: "접수 전화", placeholder: "02-000-0000" },
];

/** 연락처가 바뀌었는지 물을 때 쓰는 키 목록 — 네 칸이 한 줄이라 넷을 함께 본다 */
export const CONTACT_KEYS = CONTACT_FIELDS.map(({ key }) => key);

export function ContactValue({ contacts }: { contacts: ContactValues }) {
  const filled = CONTACT_FIELDS.filter(({ key }) => contacts[key]);
  if (filled.length === 0) return <Empty required />;
  return (
    <ul className="space-y-0.5">
      {filled.map(({ key, label }) => (
        <li key={key}>
          <span className="text-muted-foreground">{label}</span> {contacts[key]}
        </li>
      ))}
    </ul>
  );
}

export function ContactFields({
  contacts,
  onChange,
}: {
  contacts: ContactValues;
  onChange: (patch: Partial<ContactValues>) => void;
}) {
  return (
    <div className="space-y-2">
      {CONTACT_FIELDS.map(({ key, label, placeholder }) => (
        <Input
          key={key}
          className="h-9"
          aria-label={label}
          placeholder={`${label} — ${placeholder}`}
          value={contacts[key] ?? ""}
          onChange={(e) => onChange({ [key]: e.target.value })}
        />
      ))}
    </div>
  );
}

/** 금액 입력에서 숫자만 남긴다 — 빈 칸은 `0`이 아니라 `null`(값 없음)이어야 한다 */
export function parseAmount(value: string): number | null {
  const only = value.replace(/[^0-9]/g, "");
  return only === "" ? null : Number(only);
}
