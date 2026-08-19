"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { CHURCH_CHANNELS, DENOMINATIONS, REGIONS } from "@/constants/domain";
import { contactMailto } from "@/constants/business";
import { Field } from "@/components/field";
import type { Church } from "@/types/domain";

// 교회 정보 관리 폼 — mock. 실 저장·사진 업로드(Storage)는 Phase 1 Server Action.
// 교회명·교단은 인증 확정값이라 여기서 못 바꿈(문의).
// 소개(한 줄·상세)는 두지 않는다 — 표시하는 화면이 없어 입력만 받는 값이 된다(2026-08-18).

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

      <Section
        title="사무용 연락처"
        desc="교회 공식 연락처만 적어 주세요. 개인 담당자 휴대폰은 넣지 마세요(개인정보 보호). 인증 검수 때 확인한 값이라 공개 페이지에는 나오지 않아요."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="전화" optional>
            <Input
              defaultValue={church.contactTel ?? ""}
              placeholder="예) 031-000-0000"
              inputMode="tel"
              className="h-10"
            />
          </Field>
          <Field label="이메일" optional>
            <Input
              defaultValue={church.contactEmail ?? ""}
              type="email"
              placeholder="예) office@church.org"
              className="h-10"
            />
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
        {/* 사무용 연락처는 검수 대조용이라 공개 화면에 렌더하지 않는다 — "전부 반영된다"고 쓰면 거짓 안내 */}
        <p className="text-xs break-keep text-muted-foreground">
          저장하면 교회 상세 페이지에 반영돼요. 사무용 연락처는 공개되지 않아요.
        </p>
        <Button type="submit" size="lg" className="h-11 shrink-0">
          저장
        </Button>
      </div>
    </form>
  );
}
