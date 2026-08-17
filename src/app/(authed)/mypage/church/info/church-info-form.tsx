"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CHURCH_CHANNELS, DENOMINATIONS, REGIONS } from "@/constants/domain";
import { contactMailto } from "@/constants/business";
import type { Church } from "@/types/domain";

// 교회 정보 관리 폼 — mock. 실 저장·사진 업로드(Storage)는 Phase 1 Server Action.
// 교회명·교단은 인증 확정값이라 여기서 못 바꿈(문의). 소개·대표 연락처는 Phase 1 스키마 추가 예정.

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

function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">선택</span>}
      </span>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </label>
  );
}

export function ChurchInfoForm({ church }: { church: Church }) {
  const [saved, setSaved] = useState(false);
  const linkOf = (type: string) => church.links.find((l) => l.type === type)?.url ?? "";
  const photoCount = church.photos?.length ?? 0;

  return (
    <form
      className="rounded-2xl border bg-card p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(true);
      }}
    >
      <Section title="기본 정보" desc="교회명·교단은 인증으로 확정돼 바꾸려면 문의가 필요해요.">
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
          <div>
            <p className="text-sm font-bold">{church.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {church.denomination && `${DENOMINATIONS[church.denomination]} · `}인증 완료
            </p>
          </div>
          <a
            href={contactMailto("교회명·교단 수정 요청")}
            className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            수정 문의
          </a>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="지역">
            <NativeSelect className="h-10" defaultValue={church.region ?? ""} aria-label="지역">
              {/* 지역 미상이면 첫 항목(서울)이 조용히 선택돼 틀린 지역으로 굳는다 — 빈 칸을 남긴다 */}
              {church.region === null && <option value="">지역을 선택해 주세요</option>}
              {Object.entries(REGIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="시·군·구" optional>
            <Input defaultValue={church.city ?? ""} placeholder="예) 수원" className="h-10" />
          </Field>
          <Field label="창립연도" optional>
            <Input
              defaultValue={church.foundedYear?.toString() ?? ""}
              inputMode="numeric"
              placeholder="예) 1998"
              className="h-10"
            />
          </Field>
        </div>
        {/* 주소는 길어서 전폭 한 줄. 넣으면 지도가 정확해진다 — 없으면 교회명+지역으로 검색해
            동명 교회의 엉뚱한 위치를 짚을 수 있다 */}
        <Field label="주소" optional hint="교회 상세 지도에 정확한 위치를 보여줘요.">
          <Input
            defaultValue={church.address ?? ""}
            placeholder="예) 경기 수원시 영통구 월드컵로 123"
            className="h-10"
          />
        </Field>
      </Section>

      <Section title="교회 소개">
        <Field label="한 줄 소개" optional hint="교회 상세·공고 상단에 크게 노출돼요.">
          <Input placeholder="예) 다음세대를 함께 세워갈 동역자를 찾습니다." className="h-10" />
        </Field>
        <Field label="상세 소개" optional>
          <Textarea
            className="min-h-24"
            placeholder="교회 분위기, 사역 방향, 함께하고 싶은 동역자상 등을 자유롭게 적어 주세요."
            aria-label="상세 소개"
          />
        </Field>
      </Section>

      <Section
        title="대표 공개 연락처"
        desc="교회 대표 공개 연락처만 적어 주세요. 개인 담당자 휴대폰은 넣지 마세요(개인정보 보호)."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="전화" optional>
            <Input placeholder="예) 031-000-0000" inputMode="tel" className="h-10" />
          </Field>
          <Field label="이메일" optional>
            <Input type="email" placeholder="예) office@church.org" className="h-10" />
          </Field>
        </div>
      </Section>

      <Section title="교회 채널" desc="교회 공개 채널 주소만 적어 주세요.">
        <div className="space-y-2">
          {Object.entries(CHURCH_CHANNELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
              <Input
                type="url"
                defaultValue={linkOf(key)}
                placeholder="https://"
                aria-label={`${label} 주소`}
                className="h-10"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="교회 사진" desc="첫 장이 커버로 쓰여요. 교회 상세 페이지 갤러리에 나와요.">
        <div className="flex flex-wrap gap-2.5">
          {Array.from({ length: photoCount }).map((_, i) => (
            <div
              key={i}
              className="relative flex h-20 w-28 items-center justify-center rounded-xl border bg-muted text-xs text-muted-foreground"
            >
              사진 {i + 1}
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 rounded bg-brand-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  커버
                </span>
              )}
            </div>
          ))}
          {/* mock — 실 업로드는 Phase 1(Storage) */}
          <button
            type="button"
            disabled
            className="flex h-20 w-28 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed text-xs font-semibold text-primary"
          >
            ＋<span>사진 추가</span>
          </button>
        </div>
      </Section>

      {saved && (
        <p className="mt-6 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          저장 기능은 준비 중이에요. 서비스 오픈과 함께 열릴게요.
        </p>
      )}
      <div className="mt-6 flex items-center justify-between gap-3 border-t pt-6">
        <p className="text-xs break-keep text-muted-foreground">
          저장하면 교회 상세 페이지와 공고에 반영돼요.
        </p>
        <Button type="submit" size="lg" className="h-11 shrink-0">
          저장
        </Button>
      </div>
    </form>
  );
}
