"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { ChipMultiSelect, ChipSelect } from "@/components/job/chip-select";
import {
  DENOMINATIONS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  JOB_KINDS,
  PAY_PERIODS,
  POSITIONS,
  QUALIFICATIONS,
  REGIONS,
  type JobKind,
} from "@/constants/domain";
import { DENOMINATION_SOURCES } from "@/constants/review";
import { enumLabel, keyOf } from "@/lib/domain-enum";
import { payLabel, positionLabel } from "@/lib/format";
import { denominationChoice, type EditableList, type ReviewEdits } from "@/lib/review-edits";
import { isDenominationPublished } from "@/lib/review-flags";
import type { Tables } from "@/types/database";
import { Empty, Lines, ValueRow, ValueSection, type RowShared } from "./value-row";
import type { RowKey } from "./value-rows";

// 구조화된 값 전체.
//
// **구획은 공개 상세 화면과 같다** — 머리(교회·제목·자리) → 모집 조건 → 자격 요건 → 우대 사항 →
// 공고 안내 → 전형 절차 → 위치 → 지원 방법. 검수용으로 따로 지은 이름("누가 뽑나"·"어떤 자리")을
// 쓰던 것을 걷어냈다(운영자 지적 2026-08-23): 검수는 "공개되면 이렇게 보인다"를 확인하는 일인데
// 화면이 공개 화면과 다른 말로 나누면 머릿속에서 한 번 더 옮겨야 한다.
//
// 짝 규칙(종류↔직분·직무, 교단↔근거)은 컨트롤이 스스로 맞춘다(규칙 정본은 lib/review-edits.ts).
//
// ⚠️ 여기 몇 함수는 60줄을 넘는다(`IdentityRows`·`SummaryRows` 등). **분해를 검토하고 멈춘 것**이다:
//    남은 것은 분기 없는 **선언적 줄 나열**이라, 줄마다 컴포넌트로 쪼개면 6-prop 껍데기만 늘고
//    읽는 순서(= 공개 화면 순서)가 파일 안에서 흩어진다. 로직이 있는 것(`KindAndSeatRows`의 짝
//    맞추기)과 재사용되는 것(`ListRow`)만 따로 뺐다.

/** 바뀐 칸인지 묻는 함수 — 계산은 `changedEdits`가 이미 했다 */
type Touched = (...keys: (keyof ReviewEdits)[]) => boolean;

interface SectionProps extends RowShared {
  draft: ReviewEdits;
  patch: (partial: Partial<ReviewEdits>) => void;
  touched: Touched;
}

export function ValueList({
  draft,
  original,
  changed,
  patch,
  row,
  editable,
  checks,
}: RowShared & {
  draft: ReviewEdits;
  patch: (partial: Partial<ReviewEdits>) => void;
  /** 저장된 값 — 교단 판정 근거는 "손댔는가"로 정해지므로 원래 값을 알아야 한다 */
  original: ReviewEdits;
  /** 실제로 바뀐 칸(`changedEdits`) */
  changed: Partial<ReviewEdits>;
  /** 고칠 수 없는 값들의 원본 행 */
  row: Tables<"review_data">;
}) {
  const touched: Touched = (...keys) => keys.some((key) => key in changed);
  const shared: SectionProps = { draft, patch, touched, editable, checks };

  return (
    <div className="space-y-3">
      <HeadSection {...shared} original={original} row={row} />
      <TermsSection {...shared} row={row} />
      <QualificationSection {...shared} />
      <PreferredSection {...shared} />
      <NoticeSection {...shared} />
      <ProcessSection {...shared} />
      <LocationSection {...shared} />
      <ApplySection {...shared} />
    </div>
  );
}

function PreferredSection(props: SectionProps) {
  return (
    <ValueSection title="우대 사항">
      <ListRow {...props} name="preferred" field="preferred" />
    </ValueSection>
  );
}

/** 공개 상세의 "공고 안내" — 방문자가 실제로 읽는 글. 상세 본문이 이 한 칸에서 나온다 */
function NoticeSection({ draft, patch, touched, editable, checks }: SectionProps) {
  return (
    <ValueSection title="공고 안내">
      <ValueRow
        name="description"
        required
        editable={editable}
        checks={checks}
        changed={touched("description")}
        hint="AI가 쓴 요약입니다. 원문 문장을 그대로 붙이지 마세요(가드레일 #1)"
        value={draft.description ?? <Empty required />}
      >
        <Textarea
          rows={6}
          aria-label="설명"
          value={draft.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </ValueRow>
    </ValueSection>
  );
}

function ProcessSection(props: SectionProps) {
  return (
    <ValueSection title="전형 절차">
      <ListRow
        {...props}
        name="processSteps"
        field="process_steps"
        hint="접수 방법도 여기 담습니다 — 지원자가 그대로 따라야 하는 것들입니다"
      />
    </ValueSection>
  );
}

/** 공개 상세의 "위치" — 지도가 쓰는 값이라 우편 접수처와 섞이면 엉뚱한 곳에 핀이 꽂힌다 */
function LocationSection({ draft, patch, touched, editable, checks }: SectionProps) {
  return (
    <ValueSection title="위치">
      <ValueRow
        name="address"
        editable={editable}
        checks={checks}
        changed={touched("address")}
        hint="지도에 핀을 꽂는 값입니다 — 우편 접수처(지원 방법)와 다른 값이니 섞지 마세요"
        value={draft.address ?? <Empty />}
      >
        <Input
          className="h-9"
          aria-label="주소"
          placeholder="교회 위치 (도로명·지번 그대로)"
          value={draft.address ?? ""}
          onChange={(e) => patch({ address: e.target.value })}
        />
      </ValueRow>
    </ValueSection>
  );
}

/**
 * 공개 상세의 **머리** — 방문자가 제목 아래에서 한눈에 보는 것들. 공개 화면은 이 부분을 왼쪽 머리와
 * 오른쪽 카드로 나눠 그리지만 값은 한 덩어리라 여기서는 한 구획으로 둔다.
 */
function HeadSection({
  original,
  row,
  ...section
}: SectionProps & { original: ReviewEdits; row: Tables<"review_data"> }) {
  return (
    <ValueSection>
      <IdentityRows {...section} original={original} />
      <KindAndSeatRows {...section} />
      <SummaryRows {...section} row={row} />
    </ValueSection>
  );
}

/** 누구의 공고인가 — 교회명이 틀리면 다른 교회의 공고가 된다 */
function IdentityRows({
  draft,
  patch,
  touched,
  editable,
  checks,
  original,
}: SectionProps & { original: ReviewEdits }) {
  const shared = { editable, checks };
  return (
    <>
      <ValueRow
        name="churchName"
        required
        {...shared}
        changed={touched("church_name")}
        hint="틀리면 다른 교회의 공고가 됩니다 — 포스터의 교회명과 글자까지 맞춰 주세요"
        value={draft.church_name ?? <Empty required />}
      >
        <Input
          className="h-9"
          aria-label="교회명"
          value={draft.church_name ?? ""}
          onChange={(e) => patch({ church_name: e.target.value })}
        />
      </ValueRow>

      <ValueRow
        name="title"
        required
        {...shared}
        changed={touched("title")}
        hint="게시판 접두(공고·모집 등)는 크롤러가 걷어냅니다"
        value={draft.title ?? <Empty required />}
      >
        <Input
          className="h-9"
          aria-label="제목"
          value={draft.title ?? ""}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </ValueRow>

      <ValueRow
        name="denomination"
        {...shared}
        changed={touched("denomination")}
        hint={`판정 근거 ${DENOMINATION_SOURCES[draft.denomination_source]} — 고치면 "사람이 확정"으로 바뀝니다`}
        value={<DenominationValue draft={draft} />}
      >
        <NativeSelect
          aria-label="교단"
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
      </ValueRow>

      <ValueRow
        name="region"
        {...shared}
        changed={touched("region", "city")}
        hint="코드는 근거가 원문에 있는지만 봅니다 — 지역은 항상 눈으로 확인해 주세요. 비면 지역 검색에 걸리지 않습니다"
        value={
          [enumLabel(REGIONS, draft.region), draft.city].filter(Boolean).join(" ") || <Empty />
        }
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
      </ValueRow>
    </>
  );
}

/** 자리에 딸린 조건 — 부서·고용형태·금액·마감일·게시일(공개 상세의 오른쪽 카드에 해당) */
function SummaryRows({
  draft,
  patch,
  touched,
  editable,
  checks,
  row,
}: SectionProps & { row: Tables<"review_data"> }) {
  const shared = { editable, checks };
  return (
    <>
      <ValueRow
        name="department"
        {...shared}
        changed={touched("department")}
        hint="크롤 공고의 69%가 비어 있습니다 — 없는 게 정상입니다"
        value={enumLabel(DEPARTMENTS, draft.department) ?? <Empty />}
      >
        <ChipSelect
          options={DEPARTMENTS}
          value={draft.department}
          onChange={(department) => patch({ department })}
        />
      </ValueRow>

      <ValueRow
        name="employmentType"
        {...shared}
        changed={touched("employment_type")}
        value={enumLabel(EMPLOYMENT_TYPES, draft.employment_type) ?? <Empty />}
      >
        <ChipSelect
          options={EMPLOYMENT_TYPES}
          value={draft.employment_type}
          onChange={(employment_type) => patch({ employment_type })}
        />
      </ValueRow>

      <PayRow draft={draft} patch={patch} touched={touched} {...shared} />

      <ValueRow
        name="deadline"
        {...shared}
        changed={touched("deadline")}
        hint="비우면 상시모집 — 게시일부터 90일까지만 목록에 뜹니다"
        value={draft.deadline ?? "상시모집"}
      >
        <Input
          className="h-9"
          type="date"
          aria-label="마감일"
          value={draft.deadline ?? ""}
          onChange={(e) => patch({ deadline: e.target.value || null })}
        />
      </ValueRow>

      {/* 공개 상세가 "○일 전"으로 그리는 값 — 고칠 수 없다. 원문 게시일(왼쪽 열)과 다를 수 있는데,
          중복 묶음의 **최신 게시일로 덮이는 파생값**이라서다(크롤러가 끌어올린다) */}
      <ValueRow
        name="postedAt"
        {...shared}
        value={
          <>
            {row.posted_at}
            <span className="ml-1.5 text-xs text-muted-foreground">
              묶음 최신 게시일로 덮이는 파생값
            </span>
          </>
        }
      />
    </>
  );
}

/**
 * 종류·직분·직무명 — 셋이 한 덩어리다. 종류를 빼면 짝이 되는 칸도 함께 비워야 하고
 * (DB CHECK `review_data_kind_matches_seat`), 그래서 줄을 따로 두면 규칙이 두 곳으로 갈린다.
 */
function KindAndSeatRows({ draft, patch, touched, editable, checks }: SectionProps) {
  const ministry = draft.job_kind.includes("MINISTRY");
  const general = draft.job_kind.includes("GENERAL");
  const shared = { editable, checks };

  const pickKinds = (next: JobKind[]) =>
    patch({
      job_kind: next,
      position: next.includes("MINISTRY") ? draft.position : [],
      role: next.includes("GENERAL") ? draft.role : null,
    });

  return (
    <>
      <ValueRow
        name="kind"
        required
        {...shared}
        changed={touched("job_kind")}
        hint="사역직에는 직분이, 일반직에는 직무명이 반드시 짝으로 있어야 저장됩니다"
        value={draft.job_kind.map((kind) => JOB_KINDS[kind]).join(" · ") || <Empty required />}
      >
        <ChipMultiSelect options={JOB_KINDS} value={draft.job_kind} onChange={pickKinds} />
      </ValueRow>

      <ValueRow
        name="seat"
        required
        {...shared}
        changed={touched("position", "role")}
        hint="한 글에 자리가 여럿이면 직분을 모두 고릅니다"
        value={
          [positionLabel(draft.position, { full: true }), draft.role]
            .filter(Boolean)
            .join(" · ") || <Empty required />
        }
      >
        {ministry && (
          <ChipMultiSelect
            options={POSITIONS}
            value={draft.position}
            onChange={(position) => patch({ position })}
          />
        )}
        {general && (
          <Input
            className={ministry ? "mt-2 h-9" : "h-9"}
            aria-label="직무명"
            placeholder="예: 사무간사, 차량운행"
            value={draft.role ?? ""}
            onChange={(e) => patch({ role: e.target.value })}
          />
        )}
        {!ministry && !general && (
          <p className="text-xs text-muted-foreground">종류를 고르면 여기에 칸이 생깁니다.</p>
        )}
      </ValueRow>
    </>
  );
}

/** 금액 한 줄 — 주기·범위·비정형이 짝이라 한 칸에 묶여 있다(컨트롤이 셋) */
function PayRow({ draft, patch, touched, editable, checks }: SectionProps) {
  return (
    <ValueRow
      name="pay"
      // 사역직은 "사례비", 일반직은 "급여" — 공개 화면과 같은 말이어야 한다(`payLabel`이 정본)
      label={payLabel(draft.job_kind)}
      editable={editable}
      checks={checks}
      changed={touched("pay_min", "pay_max", "pay_period", "pay_note")}
      hint="주기를 정할 수 없으면 금액도 비웁니다 — 주기 없이 내보내면 연봉이 월급으로 공개됩니다"
      value={<PayValue draft={draft} />}
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
          aria-label="최소 금액 (만원)"
          placeholder="최소"
          value={draft.pay_min ?? ""}
          onChange={(e) => patch({ pay_min: parseAmount(e.target.value) })}
        />
        <span className="text-muted-foreground">~</span>
        <Input
          className="h-9"
          inputMode="numeric"
          aria-label="최대 금액 (만원)"
          placeholder="최대"
          value={draft.pay_max ?? ""}
          onChange={(e) => patch({ pay_max: parseAmount(e.target.value) })}
        />
      </div>
      <Input
        className="mt-2 h-9"
        aria-label="비정형 표현"
        placeholder="비정형 표현 (예: 교회 내규에 따름)"
        value={draft.pay_note ?? ""}
        onChange={(e) => patch({ pay_note: e.target.value })}
      />
    </ValueRow>
  );
}

/** 공개 상세의 "모집 조건" — 고칠 수 없는 네 칸이 여기 모여 있다(표시용이라 열지 않았다) */
function TermsSection({
  draft,
  patch,
  touched,
  editable,
  checks,
  row,
}: SectionProps & { row: Tables<"review_data"> }) {
  const shared = { editable, checks };
  return (
    <ValueSection title="모집 조건">
      <ValueRow name="headcount" {...shared} value={row.headcount ?? <Empty />} />
      <ValueRow name="startTiming" {...shared} value={row.start_timing ?? <Empty />} />
      <ValueRow name="workDays" {...shared} value={row.work_days ?? <Empty />} />

      <ValueRow
        name="housing"
        {...shared}
        changed={touched("housing_provided", "housing_note")}
        hint="“말하지 않음”은 “없음”과 다른 값입니다 — 그대로 공개됩니다"
        value={<HousingValue draft={draft} />}
      >
        <ChipSelect
          options={HOUSING_CHOICES}
          value={housingChoice(draft.housing_provided)}
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
      </ValueRow>

      <ValueRow name="benefit" {...shared} value={row.benefit_note ?? <Empty />} />

      <ListRow
        draft={draft}
        patch={patch}
        touched={touched}
        {...shared}
        name="requiredDocs"
        field="required_docs"
      />
      <ListRow
        draft={draft}
        patch={patch}
        touched={touched}
        {...shared}
        name="optionalDocs"
        field="optional_docs"
      />
    </ValueSection>
  );
}

/** 공개 상세의 "자격 요건" — enum 한 칸(필터용)과 원문 문장 목록이 같은 뜻을 나눠 담는다 */
function QualificationSection({ draft, patch, touched, editable, checks }: SectionProps) {
  return (
    <ValueSection title="자격 요건">
      <ValueRow
        name="qualification"
        editable={editable}
        checks={checks}
        changed={touched("qualification")}
        hint="다섯 값뿐이라 담지 못하는 조건(본 교단 신학대학원 등)은 아래 '요건'에 남깁니다. 이 칸은 검색 필터에만 쓰입니다"
        value={enumLabel(QUALIFICATIONS, draft.qualification) ?? <Empty />}
      >
        <ChipSelect
          options={QUALIFICATIONS}
          value={draft.qualification}
          onChange={(qualification) => patch({ qualification })}
        />
      </ValueRow>
      <ListRow
        draft={draft}
        patch={patch}
        touched={touched}
        editable={editable}
        checks={checks}
        name="requirements"
        field="requirements"
        hint="“본 교단 신학대학원”처럼 자격 칸이 담지 못하는 조건이 여기 남아야 합니다 — 빠지면 다른 교단 지원자가 헛지원합니다"
      />
    </ValueSection>
  );
}

/** 공개 상세의 "지원 방법" — 연락처 넷을 한 줄로(넷 중 하나는 있어야 공개된다) */
function ApplySection({ draft, patch, touched, editable, checks }: SectionProps) {
  return (
    <ValueSection title="지원 방법">
      <ValueRow
        name="contact"
        required
        editable={editable}
        checks={checks}
        changed={touched(...CONTACT_KEYS)}
        hint="넷 중 하나는 있어야 공개됩니다. 접수 주소는 원문 대조를 거치지 않은 조립 값이라 특히 확인이 필요합니다"
        value={<ContactValue draft={draft} />}
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
      </ValueRow>
    </ValueSection>
  );
}

/**
 * 목록 칸 한 줄 — 줄 단위로 고치고·지우고·더한다.
 *
 * 한 덩어리 textarea로 두지 않는 이유: 줄바꿈이 원소 구분이 되어 **원문에 줄바꿈이 있던 항목이
 * 조용히 둘로 갈린다**. 원소를 원소로 다루면 그 사고가 없다.
 */
function ListRow({
  name,
  field,
  hint,
  draft,
  patch,
  touched,
  editable,
  checks,
}: SectionProps & { name: RowKey; field: EditableList; hint?: string }) {
  const items = draft[field];
  const write = (next: string[]) => patch({ [field]: next });

  return (
    <ValueRow
      name={name}
      editable={editable}
      checks={checks}
      changed={touched(field)}
      hint={hint}
      value={items.length > 0 ? <Lines items={items} /> : <Empty />}
    >
      <div className="space-y-2">
        {/* 인덱스를 key로 쓴다 — 같은 문장이 두 번 들어올 수 있고, 순서가 곧 원소의 정체다 */}
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              className="h-9"
              aria-label={`${index + 1}번째 항목`}
              value={item}
              onChange={(e) => write(items.map((v, i) => (i === index ? e.target.value : v)))}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => write(items.filter((_, i) => i !== index))}
            >
              지우기
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => write([...items, ""])}
        >
          줄 추가
        </Button>
      </div>
    </ValueRow>
  );
}

/** 사택은 `boolean | null` 세 상태다 — **null은 "미제공"이 아니라 "원문이 말하지 않음"**이고 그대로 공개된다 */
const HOUSING_CHOICES = { PROVIDED: "제공", NONE: "없음", UNSAID: "말하지 않음" } as const;
type HousingChoice = keyof typeof HOUSING_CHOICES;

function housingChoice(provided: boolean | null): HousingChoice {
  return provided === true ? "PROVIDED" : provided === false ? "NONE" : "UNSAID";
}

function HousingValue({ draft }: { draft: ReviewEdits }) {
  return (
    <>
      {HOUSING_CHOICES[housingChoice(draft.housing_provided)]}
      {draft.housing_note && <span className="text-muted-foreground"> · {draft.housing_note}</span>}
    </>
  );
}

/**
 * 금액 표시 — 공개 화면의 `formatPay`를 쓰지 않는다. 그쪽은 주기가 **non-null**이라 없으면 월로
 * 읽히는데(`jobs.pay_period` DEFAULT 'MONTH'), 검수에서 알아야 하는 것은 정확히 **그 위험**이다.
 */
function PayValue({ draft }: { draft: ReviewEdits }) {
  const { pay_min: min, pay_max: max, pay_period: period, pay_note: note } = draft;
  const amount =
    min !== null && max !== null && min !== max
      ? `${min}~${max}만원`
      : min !== null
        ? `${min}만원`
        : max !== null
          ? `${max}만원`
          : null;

  if (amount === null) return note ? <>{note}</> : <Empty />;
  return (
    <>
      {period ? `${PAY_PERIODS[period]} ${amount}` : amount}
      {!period && <b className="ml-1.5 text-destructive">주기 없음 — 월급으로 공개됩니다</b>}
      {note && <span className="text-muted-foreground"> · {note}</span>}
    </>
  );
}

function DenominationValue({ draft }: { draft: ReviewEdits }) {
  const label = enumLabel(DENOMINATIONS, draft.denomination);
  if (label === null) return <Empty />;
  return (
    <>
      {label}
      {!isDenominationPublished(draft.denomination_source) && (
        <b className="ml-1.5 text-destructive">이대로면 교단이 공개되지 않습니다</b>
      )}
    </>
  );
}

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

const CONTACT_KEYS = CONTACT_FIELDS.map(({ key }) => key);

function ContactValue({ draft }: { draft: ReviewEdits }) {
  const filled = CONTACT_FIELDS.filter(({ key }) => draft[key]);
  if (filled.length === 0) return <Empty required />;
  return (
    <ul className="space-y-0.5">
      {filled.map(({ key, label }) => (
        <li key={key}>
          <span className="text-muted-foreground">{label}</span> {draft[key]}
        </li>
      ))}
    </ul>
  );
}

/** 숫자만 남긴다 — 빈 칸은 `0`이 아니라 `null`(값 없음)이어야 한다 */
function parseAmount(value: string): number | null {
  const only = value.replace(/[^0-9]/g, "");
  return only === "" ? null : Number(only);
}
