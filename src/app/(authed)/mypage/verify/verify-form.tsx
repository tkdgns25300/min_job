"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { DENOMINATIONS, REGIONS, POSITIONS } from "@/constants/domain";

// 교회 인증 신청 폼(단일·그룹형). mock — 실 제출·업로드·이메일 발송은 Phase 1 Server Actions.

function Section({
  num,
  title,
  hint,
  children,
}: {
  num: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t py-5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <span className="flex size-5 items-center justify-center rounded-md bg-primary text-[11px] text-primary-foreground">
          {num}
        </span>
        {title}
      </div>
      {hint && (
        <p className="mt-1 ml-7 text-xs leading-relaxed break-keep text-muted-foreground">{hint}</p>
      )}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Select({ options }: { options: Record<string, string> }) {
  return (
    <select className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
      {Object.entries(options).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function VerifyForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [showNew, setShowNew] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/10 p-6 text-center">
        <p className="font-bold text-gold-ink">인증 신청이 접수됐어요</p>
        <p className="mt-2 text-sm leading-relaxed break-keep text-muted-foreground">
          운영자 확인 후(영업일 1~2일) 공고를 등록할 수 있어요.
          <br />
          <span className="text-xs">(실 제출·승인 처리는 Phase 1)</span>
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-6 rounded-2xl border bg-card p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
    >
      {/* 1. 교회 선택 */}
      <Section
        num={1}
        title="교회 선택"
        hint="이미 등록된 교회면 검색해 선택(내 계정에 연결), 없으면 새로 등록하세요."
      >
        <Input placeholder="교회명으로 검색" aria-label="교회 검색" />
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="text-sm font-semibold text-primary hover:underline"
        >
          {showNew ? "← 기존 교회 검색으로" : "+ 찾는 교회가 없어요 — 새 교회 등록"}
        </button>
        {showNew && (
          <div className="space-y-3 rounded-xl border border-dashed bg-muted/30 p-3">
            <Field label="교회명" required>
              <Input placeholder="○○교회" />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="교단" required>
                <Select options={DENOMINATIONS} />
              </Field>
              <Field label="지역" required>
                <Select options={REGIONS} />
              </Field>
            </div>
          </div>
        )}
      </Section>

      {/* 2. 증빙 */}
      <Section
        num={2}
        title="교회 증빙"
        hint="고유번호증 또는 사업자등록증만 인정합니다(교회 사칭 방지)."
      >
        <Field label="고유번호 / 사업자등록번호" required>
          <Input placeholder="000-82-00000" inputMode="numeric" />
        </Field>
        <Field label="증빙 서류" required>
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50">
            <span>
              📄 <b className="text-primary">고유번호증</b> 또는{" "}
              <b className="text-primary">사업자등록증</b> 선택
            </span>
            <span className="text-xs">{fileName ?? "JPG · PNG · PDF"}</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
        </Field>
      </Section>

      {/* 3. 담당자 */}
      <Section num={3} title="담당자 정보" hint="이 교회 공고를 관리할 담당자예요(교회당 1명).">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="이름" required>
            <Input defaultValue={defaultName} />
          </Field>
          <Field label="직분" required>
            <Select options={POSITIONS} />
          </Field>
        </div>
        <Field label="연락처" required>
          <Input placeholder="010-0000-0000" inputMode="tel" />
        </Field>
        <Field label="이메일" required>
          <div className="flex gap-2">
            <Input
              defaultValue={defaultEmail}
              type="email"
              autoComplete="email"
              disabled={emailVerified}
              className="flex-1"
            />
            {!emailVerified && (
              <button
                type="button"
                onClick={() => setEmailSent(true)}
                className="shrink-0 rounded-lg border border-primary/40 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                인증코드 받기
              </button>
            )}
          </div>
          {emailSent && !emailVerified && (
            <div className="mt-2 flex gap-2">
              <Input placeholder="인증코드 6자리" inputMode="numeric" className="flex-1" />
              <button
                type="button"
                onClick={() => setEmailVerified(true)}
                className="shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
              >
                확인
              </button>
            </div>
          )}
          {emailVerified && (
            <p className="mt-1.5 text-xs font-semibold text-primary">✓ 이메일 인증 완료</p>
          )}
        </Field>
      </Section>

      {/* 4. 동의 */}
      <Section num={4} title="동의">
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" required className="mt-0.5 size-[18px] shrink-0 accent-primary" />
          <span className="break-keep">
            (필수){" "}
            <a href="/terms" className="underline">
              이용약관
            </a>{" "}
            및{" "}
            <a href="/privacy" className="underline">
              개인정보 수집·이용
            </a>
            에 동의합니다. 제출 서류·연락처는 인증 확인 목적으로만 사용합니다.
          </span>
        </label>
      </Section>

      <button
        type="submit"
        className="mt-5 h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        인증 신청
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        신청 후 검수중 상태가 되고, 운영자 승인 시 공고를 등록할 수 있어요.
      </p>
    </form>
  );
}
