"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { ChipMultiSelect, ChipSelect } from "@/components/job/chip-select";
import { Empty, Lines, ValueRow, ValueSection } from "@/components/admin/value-row";
import {
  ContactFields,
  ContactValue,
  CONTACT_KEYS,
  HousingFields,
  HousingValue,
  parseAmount,
} from "@/components/admin/value-fields";
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
import { enumLabel, keyOf } from "@/lib/domain-enum";
import { payLabel, positionLabel } from "@/lib/format";
import type { EditableJobList, JobEdits } from "@/lib/job-edits";

// 공개된 공고의 값 — 읽기가 기본, 고칠 때만 펼친다(줄·구획은 `components/admin/value-row`).
//
// **구획은 공개 상세 화면과 같다** — 검수 화면과 같은 이유다: 운영자가 보는 것은 "지금 공개돼 있는
// 모양"이고, 화면이 공개 화면과 다른 말로 나누면 머릿속에서 한 번 더 옮겨야 한다.
//
// ⚠️ 검수 화면(`/admin/review/[id]`)의 값 목록과 줄이 비슷하지만 **합치지 않는다.** 제약이 다르고
//    (lib/job-edits 머리말의 표), 저쪽엔 확인 체크·읽기 전용 칸이 있고 여기엔 없다. 조건문으로
//    꿰면 양쪽 규칙이 서로 새어 든다 — 공유하는 것은 줄·구획 껍데기까지다.
// ⚠️ `status`는 여기 없다 — 마감·다시 모집 전용 버튼이 쓴다(같은 컬럼에 쓰기 경로가 둘이면 갈라진다).
//
// ⚠️ 몇 함수는 60줄을 넘는다(`IdentityRows` 등). **분해를 검토하고 멈춘 것**이다: 남은 것은 분기
//    없는 선언적 줄 나열이라 줄마다 컴포넌트로 쪼개면 prop 껍데기만 늘고 읽는 순서(= 공개 화면
//    순서)가 흩어진다. 로직이 있는 것(`KindAndSeatRows`의 짝 맞추기)과 재사용되는 것(`ListRow`·
//    `TextRow`)만 따로 뺐다 — 검수 화면(`/admin/review/[id]/value-list.tsx`)과 같은 기준이다.

/** 구획·줄이 공통으로 받는 것 — `changed`는 위에서 `touched`로 접어 넘긴다(줄은 키만 물어본다) */
interface SectionProps {
  draft: JobEdits;
  patch: (partial: Partial<JobEdits>) => void;
  touched: (...keys: (keyof JobEdits)[]) => boolean;
}

export function JobValueList({
  draft,
  patch,
  changed,
  postedAt,
}: Omit<SectionProps, "touched"> & {
  /** 실제로 바뀐 칸(`changedJobEdits`) — 줄마다 "고침"을 붙이는 판단 */
  changed: Partial<JobEdits>;
  /** 고칠 수 없는 값 — 크롤러가 재게시를 만나면 끌어올린다(크롤러 SPEC §4.2b). 보여는 준다 */
  postedAt: string;
}) {
  const touched = (...keys: (keyof JobEdits)[]) => keys.some((key) => key in changed);
  const shared: SectionProps = { draft, patch, touched };

  return (
    <div className="space-y-3">
      <HeadSection {...shared} postedAt={postedAt} />
      <TermsSection {...shared} />
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
      <ListRow {...props} field="preferred" label="우대" />
    </ValueSection>
  );
}

/** 공개 상세의 "공고 안내" — 방문자가 실제로 읽는 글. 상세 본문이 이 한 칸에서 나온다 */
function NoticeSection({ draft, patch, touched }: SectionProps) {
  return (
    <ValueSection title="공고 안내">
      <ValueRow
        label="설명"
        required
        changed={touched("description")}
        hint="공개 상세의 본문입니다. 원문 문장을 그대로 옮기지 마세요 — 요약 + 출처 링크가 우리 방어선입니다(가드레일 #1)"
        value={draft.description || <Empty required />}
      >
        <Textarea
          rows={6}
          aria-label="설명"
          value={draft.description}
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
        field="process_steps"
        label="절차"
        hint="접수 방법도 여기 담습니다 — 지원자가 그대로 따라야 하는 것들입니다"
      />
    </ValueSection>
  );
}

/** 공개 상세의 "위치" — 지도가 쓰는 값이라 우편 접수처와 섞이면 엉뚱한 곳에 핀이 꽂힌다 */
function LocationSection({ draft, patch, touched }: SectionProps) {
  return (
    <ValueSection title="위치">
      <ValueRow
        label="주소"
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

/** 공개 상세의 머리 — 방문자가 제목 아래에서 한눈에 보는 것들 */
/**
 * 공개 상세의 **머리** — 방문자가 제목 아래에서 한눈에 보는 것들. 공개 화면은 이 부분을 왼쪽 머리와
 * 오른쪽 카드로 나눠 그리지만 값은 한 덩어리라 여기서는 한 구획으로 둔다.
 */
function HeadSection({ postedAt, ...section }: SectionProps & { postedAt: string }) {
  return (
    <ValueSection>
      <IdentityRows {...section} />
      <KindAndSeatRows {...section} />
      <SummaryRows {...section} postedAt={postedAt} />
    </ValueSection>
  );
}

/** 누구의 공고인가 — 교회명이 틀리면 다른 교회의 공고가 된다 */
function IdentityRows({ draft, patch, touched }: SectionProps) {
  return (
    <>
      <ValueRow
        label="교회명"
        required
        changed={touched("church_name")}
        hint="틀리면 다른 교회의 공고가 됩니다 — 비울 수 없습니다"
        value={draft.church_name || <Empty required />}
      >
        <Input
          className="h-9"
          aria-label="교회명"
          value={draft.church_name}
          onChange={(e) => patch({ church_name: e.target.value })}
        />
      </ValueRow>

      <ValueRow
        label="제목"
        required
        changed={touched("title")}
        value={draft.title || <Empty required />}
      >
        <Input
          className="h-9"
          aria-label="제목"
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </ValueRow>

      <ValueRow
        label="교단"
        changed={touched("denomination")}
        hint="미상이면 교단 필터에서 빠집니다. 공개 화면은 미상을 표시하지 않고 조각째 생략합니다"
        value={enumLabel(DENOMINATIONS, draft.denomination) ?? <Empty />}
      >
        <NativeSelect
          aria-label="교단"
          value={draft.denomination ?? ""}
          onChange={(e) => patch({ denomination: keyOf(DENOMINATIONS, e.target.value) })}
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
        label="지역"
        changed={touched("region", "city")}
        hint="비면 지역 검색에 걸리지 않습니다"
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
function SummaryRows({ draft, patch, touched, postedAt }: SectionProps & { postedAt: string }) {
  return (
    <>
      <ValueRow
        label="부서"
        changed={touched("department")}
        value={enumLabel(DEPARTMENTS, draft.department) ?? <Empty />}
      >
        <ChipSelect
          options={DEPARTMENTS}
          value={draft.department}
          onChange={(department) => patch({ department })}
        />
      </ValueRow>

      <ValueRow
        label="고용형태"
        changed={touched("employment_type")}
        value={enumLabel(EMPLOYMENT_TYPES, draft.employment_type) ?? <Empty />}
      >
        <ChipSelect
          options={EMPLOYMENT_TYPES}
          value={draft.employment_type}
          onChange={(employment_type) => patch({ employment_type })}
        />
      </ValueRow>

      <PayRow draft={draft} patch={patch} touched={touched} />

      <ValueRow
        label="마감일"
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

      {/* 공개 상세가 "○일 전"으로 그리는 값 — 크롤러가 재게시를 만나면 끌어올리므로 우리 것이 아니다 */}
      <ValueRow
        label="게시일"
        value={
          <>
            {postedAt}
            <span className="ml-1.5 text-xs text-muted-foreground">수집이 관리 · 고칠 수 없음</span>
          </>
        }
      />
    </>
  );
}

/**
 * 종류·직분·직무명 — 셋이 한 덩어리다. 종류를 빼면 짝이 되는 칸도 함께 비워야 하고
 * (CHECK `jobs_kind_matches_seat`), 그래서 줄을 따로 두면 규칙이 두 곳으로 갈린다.
 * ⚠️ `jobs`는 종류가 **비어 있을 수 없다** — 검수와 다른 점이다(lib/job-edits).
 */
function KindAndSeatRows({ draft, patch, touched }: SectionProps) {
  const ministry = draft.job_kind.includes("MINISTRY");
  const general = draft.job_kind.includes("GENERAL");

  const pickKinds = (next: JobKind[]) =>
    patch({
      job_kind: next,
      position: next.includes("MINISTRY") ? draft.position : [],
      role: next.includes("GENERAL") ? draft.role : null,
    });

  return (
    <>
      <ValueRow
        label="종류"
        required
        changed={touched("job_kind")}
        hint="하나 이상 골라야 합니다. 사역직에는 직분이, 일반직에는 직무명이 짝으로 있어야 저장됩니다"
        value={draft.job_kind.map((kind) => JOB_KINDS[kind]).join(" · ") || <Empty required />}
      >
        <ChipMultiSelect options={JOB_KINDS} value={draft.job_kind} onChange={pickKinds} />
      </ValueRow>

      <ValueRow
        label="직분·직무"
        required
        changed={touched("position", "role")}
        hint="한 공고에 자리가 여럿이면 직분을 모두 고릅니다"
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

/**
 * 금액 한 줄 — 주기·범위·비정형이 짝이라 한 칸에 묶여 있다.
 * ⚠️ `jobs.pay_period`는 **NOT NULL**이라 비울 수 없다(검수와 다른 점). 금액이 없어도 주기는 남는다.
 */
function PayRow({ draft, patch, touched }: SectionProps) {
  return (
    <ValueRow
      label={payLabel(draft.job_kind)}
      changed={touched("pay_min", "pay_max", "pay_period", "pay_note")}
      hint="금액을 비우면 공개 화면은 비정형 표현을, 그것도 없으면 “협의”를 보여줍니다"
      value={<PayValue draft={draft} />}
    >
      <ChipSelect
        options={PAY_PERIODS}
        value={draft.pay_period}
        // 주기는 NOT NULL — 재클릭 해제를 무시한다(해제를 null로 받으면 저장이 막힌다)
        onChange={(pay_period) => pay_period && patch({ pay_period })}
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

/** 공개 상세의 "모집 조건" */
function TermsSection({ draft, patch, touched }: SectionProps) {
  return (
    <ValueSection title="모집 조건">
      <TextRow
        label="모집 인원"
        value={draft.headcount}
        changed={touched("headcount")}
        onChange={(headcount) => patch({ headcount })}
        placeholder="예: 1명, 약간명"
      />
      <TextRow
        label="부임 시기"
        value={draft.start_timing}
        changed={touched("start_timing")}
        onChange={(start_timing) => patch({ start_timing })}
        placeholder="예: 즉시, 협의"
      />
      <TextRow
        label="출근"
        value={draft.work_days}
        changed={touched("work_days")}
        onChange={(work_days) => patch({ work_days })}
        placeholder="예: 주 5일"
        hint="비우면 공개 화면은 “협의”로 보여줍니다"
      />

      <ValueRow
        label="사택"
        changed={touched("housing_provided", "housing_note")}
        hint="“말하지 않음”은 “없음”과 다릅니다 — 말하지 않음이면 공개 화면에서 줄째 사라집니다"
        value={<HousingValue provided={draft.housing_provided} note={draft.housing_note} />}
      >
        <HousingFields
          provided={draft.housing_provided}
          note={draft.housing_note}
          onProvided={(housing_provided) => patch({ housing_provided })}
          onNote={(housing_note) => patch({ housing_note })}
        />
      </ValueRow>

      <TextRow
        label="복리후생"
        value={draft.benefit_note}
        changed={touched("benefit_note")}
        onChange={(benefit_note) => patch({ benefit_note })}
      />
      <ListRow
        draft={draft}
        patch={patch}
        touched={touched}
        field="required_docs"
        label="필수 서류"
      />
      <ListRow
        draft={draft}
        patch={patch}
        touched={touched}
        field="optional_docs"
        label="선택 서류"
      />
    </ValueSection>
  );
}

/** 공개 상세의 "자격 요건" — enum 한 칸(필터용)과 원문 문장 목록이 같은 뜻을 나눠 담는다 */
function QualificationSection({ draft, patch, touched }: SectionProps) {
  return (
    <ValueSection title="자격 요건">
      <ValueRow
        label="자격"
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
        field="requirements"
        label="요건"
        hint="“본 교단 신학대학원”처럼 자격 칸이 담지 못하는 조건이 여기 남아야 합니다 — 빠지면 다른 교단 지원자가 헛지원합니다"
      />
    </ValueSection>
  );
}

/** 공개 상세의 "지원 방법" — 넷 중 하나는 있어야 저장된다(CHECK `jobs_needs_contact`) */
function ApplySection({ draft, patch, touched }: SectionProps) {
  return (
    <ValueSection title="지원 방법">
      <ValueRow
        label="연락처"
        required
        changed={touched(...CONTACT_KEYS)}
        hint="넷 중 하나 이상 있어야 저장됩니다. 지원자가 실제로 서류를 보내는 곳이니 가장 먼저 확인해 주세요"
        value={<ContactValue contacts={draft} />}
      >
        <ContactFields contacts={draft} onChange={patch} />
      </ValueRow>
    </ValueSection>
  );
}

/** 자유 텍스트 한 칸 — 모집 조건 쪽에 같은 모양이 넷 있다 */
function TextRow({
  label,
  value,
  changed,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string | null;
  changed: boolean;
  onChange: (next: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <ValueRow label={label} changed={changed} hint={hint} value={value ?? <Empty />}>
      <Input
        className="h-9"
        aria-label={label}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </ValueRow>
  );
}

/**
 * 목록 칸 한 줄 — 줄 단위로 고치고·지우고·더한다.
 * 한 덩어리 textarea로 두면 줄바꿈이 원소 구분이 되어 **원문에 줄바꿈이 있던 항목이 둘로 갈린다.**
 */
function ListRow({
  field,
  label,
  hint,
  draft,
  patch,
  touched,
}: SectionProps & { field: EditableJobList; label: string; hint?: string }) {
  const items = draft[field];
  const write = (next: string[]) => patch({ [field]: next });

  return (
    <ValueRow
      label={label}
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

/** 금액 표시 — 공개 화면의 `formatPay`와 같은 순서(범위 → 단일 → 비정형 → 협의) */
function PayValue({ draft }: { draft: JobEdits }) {
  const { pay_min: min, pay_max: max, pay_period: period, pay_note: note } = draft;
  const amount =
    min !== null && max !== null && min !== max
      ? `${min}~${max}만원`
      : min !== null
        ? `${min}만원`
        : max !== null
          ? `${max}만원`
          : null;

  if (amount === null)
    return note ? <>{note}</> : <span className="text-muted-foreground">협의</span>;
  return (
    <>
      {PAY_PERIODS[period]} {amount}
      {note && <span className="text-muted-foreground"> · {note}</span>}
    </>
  );
}
