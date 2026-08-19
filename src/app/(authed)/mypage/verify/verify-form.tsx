"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DENOMINATIONS, REGIONS, POSITIONS } from "@/constants/domain";
import { contactMailto } from "@/constants/business";
import { Field } from "@/components/field";

// 교회 인증 신청 폼(단일·그룹형). mock — 실 제출·업로드·결과 알림 메일은 Phase 1 Server Actions.
// ⚠️ 제출은 아무 데이터도 보내지 않는다. 실 로그인 전환(2026-07-29) 이후 누구나 이 화면에 올 수 있으므로
//    "접수됐어요"라고 하면 거짓 안내가 된다 → 폼 앞에서 미리 알리고, 제출 후에도 저장되지 않았음을 밝힌다.
const VERIFY_REQUEST_MAILTO = contactMailto("[민잡] 교회 인증 요청");

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

function Select({ options }: { options: Record<string, string> }) {
  return (
    <NativeSelect className="h-11">
      {Object.entries(options).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </NativeSelect>
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
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/10 p-6 text-center">
        <p className="font-bold text-gold-ink">온라인 접수는 아직 준비 중이에요</p>
        <p className="mt-2 text-sm leading-relaxed break-keep text-muted-foreground">
          입력하신 내용은 저장되지 않았어요.
          <br />
          <a href={VERIFY_REQUEST_MAILTO} className="font-semibold text-foreground underline">
            운영자에게 이메일로 인증 요청
          </a>
          하시면 확인 후 처리해 드려요.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 폼을 채우기 전에 실제 경로를 먼저 알린다 — 헛수고·불필요한 정보 입력 방지 */}
      <div className="mt-4 rounded-xl border border-gold/40 bg-gold/10 p-4 text-left">
        <p className="text-sm font-bold text-gold-ink">온라인 인증 신청은 준비 중이에요</p>
        <p className="mt-1 text-sm leading-relaxed break-keep text-muted-foreground">
          아래 폼은 어떤 정보가 필요한지 미리 보여드리는 화면이에요. 지금은{" "}
          <a href={VERIFY_REQUEST_MAILTO} className="font-semibold text-foreground underline">
            운영자에게 이메일로 요청
          </a>
          하시면 확인 후 처리해 드려요.
        </p>
      </div>
      <form
        className="mt-4 rounded-2xl border bg-card p-5 sm:p-6"
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
          hint="고유번호증 또는 사업자등록증만 인정합니다(교회 사칭 방지). 사무용 연락처는 교회 공식 정보와 대조해요."
        >
          <Field label="증빙 서류" required group>
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
          {/* 사무용 연락처 = 검수의 축 — 운영자가 공개 게시판 공고·홈페이지와 대조한다(DATA §3).
              이메일만 선택인 이유: 사무용 이메일이 없는 작은 교회가 실재해, 필수로 두면 못 들어온다 */}
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="사무용 전화" required>
              <Input placeholder="02-000-0000" inputMode="tel" />
            </Field>
            <Field label="사무용 이메일" optional>
              <Input type="email" placeholder="office@church.or.kr" />
            </Field>
          </div>
        </Section>

        {/* 3. 담당자 */}
        <Section
          num={3}
          title="담당자 정보"
          hint="이 교회 공고를 관리할 담당자예요. 담당자는 여러 명일 수 있고 각자 인증합니다."
        >
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="이름" required>
              <Input defaultValue={defaultName} />
            </Field>
            <Field label="직분" required>
              <Select options={POSITIONS} />
            </Field>
          </div>
          {/* 이메일은 로그인 계정을 그대로 쓴다 — Google OAuth로 이미 검증된 값이라 재인증이 없다.
              담당자 개인 전화는 받지 않는다: 사칭자가 자기 번호를 적고 자기가 받으므로 검증이 안 된다 */}
          <Field label="이메일">
            <Input defaultValue={defaultEmail} type="email" disabled />
          </Field>
        </Section>

        {/* 4. 동의 */}
        <Section num={4} title="동의">
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              required
              className="mt-0.5 size-[18px] shrink-0 accent-primary"
            />
            <span className="break-keep">
              (필수){" "}
              <a href="/terms" className="underline">
                이용약관
              </a>{" "}
              및{" "}
              <a href="/privacy" className="underline">
                개인정보 수집·이용
              </a>
              에 동의합니다. 제출 서류·담당자 정보는 인증 확인 목적으로만 사용합니다.
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
          지금은 온라인 접수가 되지 않아요 — 위 안내대로 운영자에게 이메일로 요청해 주세요.
        </p>
      </form>
    </>
  );
}
