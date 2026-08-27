"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  CHURCH_CHANNELS,
  ADDRESS_PLACEHOLDER,
  CITY_HINT,
  CITY_PLACEHOLDER,
  DENOMINATIONS,
  REGIONS,
  type ChurchChannel,
  type Region,
} from "@/constants/domain";
import { Field } from "@/components/field";
import { MAX_LENGTHS } from "@/lib/church-verification";
import {
  MAX_CHANNEL_URL,
  infoErrors,
  toInfoDraft,
  type ChurchInfoDraft,
  type InfoErrors,
} from "@/lib/church-info";
import { saveChurchInfo } from "./actions";
import type { Church } from "@/types/domain";

// 교회 정보 관리 폼.
//
// draft의 모양·검증·DB 변환은 `lib/church-info`가 단일 소스다 — 폼과 Server Action이 같은 답을
// 써야 해서다(제출은 액션이 같은 검증을 다시 돌린다). 여기 남는 것은 **화면 조립**뿐이다.
//
// ⛔ **교회명·교단은 여기서 못 바꾼다** — 인증으로 확정된 값이라 미검증 입력이 덮으면 안 된다.
//    "수정 문의" mailto도 없앴다(2026-08-27 · 운영자 결정): 드문 일에 상시 링크를 두는 값이
//    낮고, 필요하면 푸터 문의로 간다. 공고 폼에서 같은 링크를 같은 이유로 없앴다(2026-08-26).
// ⛔ **소개(한 줄·상세)는 두지 않는다** — 표시하는 화면이 없어 입력만 받는 값이 된다(2026-08-18).
// ⬜ **사진은 아직 배선되지 않았다** — 공개 이미지라 지금 있는 비공개 버킷 둘과 성질이 반대여서
//    공개 버킷 설계·업로드 권한을 따로 푼다(ROADMAP).

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="border-t py-6 first:border-t-0 first:pt-0">
      <h2 className="text-base font-bold">{title}</h2>
      {desc && (
        <p className="mt-1 text-sm leading-relaxed break-keep text-muted-foreground">{desc}</p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function ChurchInfoForm({ church }: { church: Church }) {
  const [draft, setDraft] = useState<ChurchInfoDraft>(() => toInfoDraft(church));
  const [errors, setErrors] = useState<InfoErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startSave] = useTransition();

  /** 고치기 시작한 칸의 오류·직전 결과는 지운다 — 남아 있으면 무엇이 아직 문제인지 알 수 없다 */
  const patch = (partial: Partial<ChurchInfoDraft>) => {
    setDraft((d) => ({ ...d, ...partial }));
    setSaved(false);
    setFailure(null);
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(partial)) delete next[key as keyof InfoErrors];
      return next;
    });
  };

  const patchLink = (type: ChurchChannel, url: string) => {
    setDraft((d) => ({ ...d, links: { ...d.links, [type]: url } }));
    setSaved(false);
    setFailure(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`link:${type}`];
      return next;
    });
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = infoErrors(draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setSaved(false);
      setFailure(null);
      return;
    }
    setErrors({});
    setFailure(null);
    startSave(async () => {
      try {
        const result = await saveChurchInfo(draft);
        // 액션이 같은 검증을 다시 돌린다(신뢰 경계는 서버다) — 걸리면 그 답을 그대로 쓴다
        if (result.errors) {
          setErrors(result.errors);
          setSaved(false);
        } else if (result.message) {
          setFailure(result.message);
          setSaved(false);
        } else setSaved(true);
      } catch (thrown) {
        unstable_rethrow(thrown);
        console.error("[church-info] 저장 실패", thrown);
        setFailure("저장하지 못했어요. 적은 내용은 그대로 있으니 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-5 sm:p-6">
      <Section title="기본 정보" desc="교회명·교단은 인증으로 확정된 값이라 여기서 바꿀 수 없어요.">
        <div className="rounded-xl border bg-muted/30 px-4 py-3">
          <p className="text-sm font-bold">{church.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {church.denomination && `${DENOMINATIONS[church.denomination]} · `}인증 완료
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* ⚠️ 지역·시·군·구는 **필수**다 — 인증 신청에서 이미 필수로 받는 값이고, 여기서 비우면
              그 뒤로 **새로 등록하는 공고가 `jobs.region`을 빈 채로 물려받아** 지역 필터에서
              탈락한다(`lib/church-info` 머리말) */}
          <Field label="지역" required error={errors.region}>
            <NativeSelect
              className="h-10"
              value={draft.region ?? ""}
              onChange={(e) => patch({ region: (e.target.value || null) as Region | null })}
              aria-label="지역"
            >
              <option value="">선택</option>
              {Object.entries(REGIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="시·군·구" required hint={CITY_HINT} error={errors.city}>
            <Input
              value={draft.city}
              onChange={(e) => patch({ city: e.target.value })}
              placeholder={CITY_PLACEHOLDER}
              maxLength={MAX_LENGTHS.city}
              className="h-10"
            />
          </Field>
        </div>

        <Field
          label="상세 주소"
          optional
          hint="지역·시·군·구 다음 부분만 적어 주세요. 교회 페이지 지도에 쓰여요."
          error={errors.address}
        >
          <Input
            value={draft.address}
            onChange={(e) => patch({ address: e.target.value })}
            placeholder={ADDRESS_PLACEHOLDER}
            maxLength={MAX_LENGTHS.address}
            className="h-10"
          />
        </Field>

        <div className="sm:max-w-[14rem]">
          {/* 상한 힌트는 평소 감춘다 — 맞게 쓰는 교회에게 규칙을 미리 읽힐 이유가 없다 */}
          <Field label="창립연도" optional error={errors.foundedYear}>
            <Input
              inputMode="numeric"
              value={draft.foundedYear}
              onChange={(e) => patch({ foundedYear: e.target.value })}
              placeholder="예) 1958"
              maxLength={4}
              className="h-10 tabular-nums"
            />
          </Field>
        </div>
      </Section>

      {/* ⚠️ **왜 여기서 고치나**를 말한다 — "검수 때 확인한 값"이라고만 쓰면 교회가 자기 일인지 모른다.
          승인할 때 `approveVerification`이 신청서의 연락처를 이 컬럼으로 옮겨 두고(빈 칸일 때만),
          그 뒤로는 **이 화면이 유일한 수정 경로**다.
          ⚠️ `/admin/verify` 큐에 보이는 연락처는 이 컬럼이 아니라 **신청자가 적어낸 값**
             (`users.verification_contact_*`)이다 — `queries/verifications.ts`가 그렇게 밝힌다.
             즉 `churches.contact_*`를 그리는 화면은 아직 없고, 운영자는 DB로 본다. */}
      <Section
        title="사무용 연락처"
        desc="운영자가 교회에 연락할 때 쓰는 번호예요. 구직자에게는 보이지 않아요. 개인 담당자 휴대폰 대신 교회 대표 번호를 적어 주세요."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="전화" optional error={errors.contactTel}>
            <Input
              value={draft.contactTel}
              onChange={(e) => patch({ contactTel: e.target.value })}
              placeholder="예) 031-000-0000"
              inputMode="tel"
              maxLength={MAX_LENGTHS.contactTel}
              className="h-10 tabular-nums"
            />
          </Field>
          <Field label="이메일" optional error={errors.contactEmail}>
            <Input
              value={draft.contactEmail}
              onChange={(e) => patch({ contactEmail: e.target.value })}
              type="email"
              placeholder="예) office@church.org"
              maxLength={MAX_LENGTHS.contactEmail}
              className="h-10"
            />
          </Field>
        </div>
      </Section>

      {/* `https://`가 자동으로 붙는 것은 **동작이지 교회가 알 일이 아니다** — 안내하지 않는다.
          비우면 사라진다는 것만 말한다(결과가 달라지므로). */}
      <Section title="교회 채널" desc="주소만 붙여 넣으면 돼요. 비워 두면 교회 페이지에서 그 채널이 사라져요.">
        {/* ⛔ **`Field`로 감싸지 않는다** — 채널 이름이 이미 줄 왼쪽에 보여서 `Field`의 라벨과
            겹치고, 여섯 칸을 세로로 쌓으면 나란한 목록이라는 성질이 사라진다. 대신 오류 자리를
            줄 안에 직접 둔다(`Field`와 같은 모양·같은 `role="alert"`). 여러 화면이 쓰는 공용
            부품에 이 한 곳을 위한 prop을 늘리지 않는다. */}
        {(Object.entries(CHURCH_CHANNELS) as [ChurchChannel, string][]).map(([key, label]) => {
          const error = errors[`link:${key}`];
          return (
            <div key={key} className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-2">
              <span className="pt-2.5 text-xs text-muted-foreground">{label}</span>
              <div>
                {/* ⛔ **`type="url"`을 쓰지 않는다.** 이 폼은 "주소만 붙여 넣으면 `https://`를
                    붙여 준다"로 설계했는데, `type="url"`은 스킴 없는 값을 **무효로 보고 제출
                    자체를 막는다** — 클릭은 되는데 `submit`이 안 나가 아무 일도 일어나지 않았다
                    (실측 2026-08-27: `andongtaehwa.org` → "URL을 입력하세요"). 형식 판정은
                    `normalizeChannelUrl`이 하므로 브라우저 검사는 필요 없고, `inputMode`로
                    모바일 자판만 URL용으로 둔다. */}
                <Input
                  type="text"
                  inputMode="url"
                  value={draft.links[key] ?? ""}
                  onChange={(e) => patchLink(key, e.target.value)}
                  placeholder="주소를 붙여 넣어 주세요"
                  aria-label={`${label} 주소`}
                  aria-invalid={error ? true : undefined}
                  maxLength={MAX_CHANNEL_URL}
                  className="h-10"
                />
                {error && (
                  <p className="mt-1.5 text-xs text-destructive" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </Section>

      <Section title="교회 사진" desc="첫 장이 커버로 쓰여요. 교회 페이지 갤러리에 나와요.">
        <div className="flex flex-wrap gap-2.5">
          {/* ⚠️ **실제 사진을 그린다** — 회색 네모에 "사진 1"이라고 적어 두면 구획 설명("갤러리에
              나와요")이 거짓이 된다. 공개 갤러리(`church-gallery.tsx`)와 같이 `backgroundImage`를
              쓴다: `next/image`는 `remotePatterns` 설정이 필요한데 아직 버킷이 없다.
              ⚠️ `key`에 순번을 함께 넣는다 — 같은 URL이 두 장이면 `url`만으로는 충돌한다. */}
          {(church.photos ?? []).map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative h-20 w-28 rounded-xl border bg-muted bg-cover bg-center"
              style={{ backgroundImage: `url(${url})` }}
              role="img"
              aria-label={`교회 사진 ${i + 1}`}
            >
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 rounded bg-brand-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  커버
                </span>
              )}
            </div>
          ))}
          <button
            type="button"
            disabled
            className="flex h-20 w-28 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed text-xs font-semibold text-primary"
          >
            ＋<span>사진 추가</span>
          </button>
        </div>
        {/* ⚠️ 눌러도 아무 일이 없는 버튼은 **이유를 말해야** 한다 — 안 그러면 고장으로 읽힌다 */}
        <p className="text-xs text-muted-foreground">사진 올리기는 준비 중이에요.</p>
      </Section>

      {/* ⚠️ **안내는 버튼 위에 둔다.** 아래에 두면 폼이 길어서 누른 사람의 시선 밖에 뜬다 —
          저장했는지 모르고 한 번 더 누르게 된다(실측 2026-08-27). 버튼 바로 위면 누른 자리에서
          보인다.
          ⬜ 이 자리는 결국 **토스트**로 바뀐다 — 화면에 머무는 성공 지점이 앱에 넷이고 지금
             넷이 각자 다른 방식으로 만들어져 있다(하나는 성공을 아예 안 알린다 · ROADMAP). */}
      <div className="mt-6 border-t pt-6">
        {saved && (
          <p
            className="mb-3.5 rounded-lg bg-primary/[0.08] px-3.5 py-2.5 text-sm break-keep text-brand-700"
            role="status"
          >
            저장했어요. 교회 페이지에 반영됐어요.
          </p>
        )}
        {Object.keys(errors).length > 0 && (
          <p
            className="mb-3.5 rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm break-keep text-destructive"
            role="alert"
          >
            표시된 곳을 고치면 저장할 수 있어요.
          </p>
        )}
        {failure && (
          <p
            className="mb-3.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm font-semibold break-keep text-destructive"
            role="alert"
          >
            {failure}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="lg" className="h-11" disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
    </form>
  );
}
