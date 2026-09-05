"use client";

import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import {
  ADDRESS_PLACEHOLDER,
  CITY_HINT,
  CITY_PLACEHOLDER,
  DENOMINATIONS,
  POSITIONS,
  REGIONS,
} from "@/constants/domain";
import { PRIVACY_EFFECTIVE_DATE } from "@/constants/business";
import {
  DENOMINATION_INDEPENDENT,
  DOC_ACCEPT,
  DOC_FORMATS_LABEL,
  DOC_MAX_BYTES,
  docError,
  MAX_LENGTHS,
  normalizeRegistrationNo,
  REGISTRATION_NO_LENGTH,
  type FieldErrors,
} from "@/lib/church-verification";
import {
  applyChurchVerification,
  lookupChurch,
  type ApplyResult,
  type LookupResult,
} from "./actions";

// 교회 인증 신청 폼.
//
// **고유번호를 확인해야 나머지가 열린다.** 무엇을 저장할지(처음 등록 / 기존 교회 담당자 추가)가
// 정해지기 전에는 받을 칸이 정해지지 않는다. 자동 조회(10자리를 채우면)를 쓰지 않는 이유: 오타로
// 10자리가 되면 "처음 등록"으로 판정돼 칸이 펼쳐지고 고치면 다시 접혀 **깜빡인다.**
//
// 검증은 `lib/church-verification`이 단일 소스다 — 여기서 미리 돌려 왕복을 아끼고, **신뢰 경계는
// 액션**이라 서버가 같은 검증을 다시 한다(길이 상한도 그 모듈이 갖고 `maxLength`와 같은 값을 쓴다).
//
// ⛔ **JS 없이 끝까지 제출되지는 않는다** — 게이트가 확인 결과(클라이언트 상태)에 걸려 있어 JS가
//    없으면 "확인"이 동작하지 않는다. `useActionState`를 쓰는 이유는 progressive enhancement가
//    아니라 **칸별 오류를 상태로 받는 것**이다(액션 머리말).

/**
 * 확인 결과 — `null`은 아직 확인 안 함(제출 잠김). 오류는 별 state가 받으므로 여기서 뺀다.
 * 액션의 반환 타입에서 파생한다 — 손으로 한 벌 더 쓰면 응답 모양이 바뀔 때 갈린다.
 */
type Lookup = Exclude<LookupResult, { kind: "error" }> | null;

export function VerifyForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [regNo, setRegNo] = useState("");
  const [lookup, setLookup] = useState<Lookup>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [doc, setDoc] = useState<File | null>(null);
  const [docFailure, setDocFailure] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [result, setResult] = useState<ApplyResult>({});
  const router = useRouter();

  /**
   * 지금 입력창에 있는 번호. **`regNo` state와 따로 두는 이유가 있다** — 조회 콜백은 자기 렌더의
   * 클로저를 들고 있어서 `asked !== regNo`로 비교하면 **같은 값끼리 비교**가 되어 아무것도 못 막는다.
   * ref는 편집 때마다 갱신되므로 await 뒤에 "그 사이 바뀌었나"를 실제로 볼 수 있다.
   */
  const typedRegNo = useRef("");

  // 번호를 고치면 확인이 무효가 된다 — 다른 교회의 결과를 들고 제출하면 안 된다
  const editRegNo = (raw: string) => {
    const digits = normalizeRegistrationNo(raw);
    typedRegNo.current = digits;
    setRegNo(digits);
    setLookup(null);
    setLookupError(null);
  };

  const check = () =>
    startCheck(async () => {
      // ⚠️ 조회 중에도 입력은 살아 있다 — 응답이 **그 사이 바뀐 번호**에 붙으면 "○○교회 담당자로
      //    신청합니다"를 띄운 채 교회 칸을 감추고, 제출하면 서버가 새 번호로 조회해 그 감춰진
      //    칸들의 오류를 돌려준다(화면에 없는 오류).
      const asked = typedRegNo.current;
      setLookupError(null);
      const result = await lookupChurch(asked);
      if (typedRegNo.current !== asked) return;
      if (result.kind === "error") {
        setLookup(null);
        setLookupError(result.message);
        return;
      }
      setLookup(result);
    });

  /**
   * ⚠️ **`<form action={submit}>`을 쓰지 않는다.** React는 폼 액션을 실행하기 **전에**
   * `requestFormReset`을 무조건 부르므로(react-dom `startHostTransition` · 19.2 소스 확인),
   * 검증 오류를 돌려주면 **입력이 통째로 비워진 채 오류만 남고 고른 파일도 사라진다.**
   * `onSubmit`에서 `FormData`를 직접 만들어 부르면 리셋이 일어나지 않아 값이 남는다.
   */
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 이벤트가 끝나면 `currentTarget`이 비므로 지금 만들어 둔다
    const formData = new FormData(event.currentTarget);
    startSubmit(async () => {
      const next = await applyChurchVerification(formData);
      if (next.errors || next.message) {
        setResult(next);
        return;
      }
      // 접수됨 — 알림·계측 뒤 같은 페이지를 다시 그리면 상태(PENDING) 안내가 폼을 대신한다
      // (액션의 redirect는 던져서 이 줄에 못 온다 · CLAUDE Styling)
      track({ name: "verify_submit" });
      toast.success("인증 신청을 접수했습니다.");
      router.refresh();
    });
  };

  const isNew = lookup?.kind === "new";
  const locked = lookup === null;
  // 서버가 돌려준 오류에 파일 오류를 얹는다 — 파일은 고르는 순간 검사해 헛업로드를 막는다
  const errors: FieldErrors = { ...result.errors, ...(docFailure ? { doc: docFailure } : {}) };
  const message = result.message ?? null;

  return (
    <form className="mt-4 rounded-2xl border bg-card p-5 sm:p-6" onSubmit={onSubmit}>
      {message && (
        <p
          className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive"
          role="alert"
        >
          {message}
        </p>
      )}

      <Step
        num={1}
        title="교회 확인"
        hint="고유번호로 교회를 찾아요. 이미 등록된 교회면 그 교회의 담당자로 신청됩니다 — 한 교회에 담당자가 여러 명일 수 있어요."
      >
        <Field label="고유번호" required error={errors.registrationNo} group>
          <div className="flex gap-2">
            <Input
              name="registrationNo"
              value={regNo}
              onChange={(e) => editRegNo(e.target.value)}
              inputMode="numeric"
              maxLength={REGISTRATION_NO_LENGTH}
              placeholder="숫자 10자리"
              aria-label="고유번호"
              className="flex-1 tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              onClick={check}
              disabled={checking || regNo.length < REGISTRATION_NO_LENGTH}
            >
              {checking ? "확인 중…" : lookup ? "다시 확인" : "확인"}
            </Button>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            고유번호증·사업자등록증에 적힌 번호예요. 하이픈은 빼고 숫자만 입력돼요.
          </p>
          {lookupError && (
            <p
              className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive"
              role="alert"
            >
              {lookupError}
            </p>
          )}
          {lookup?.kind === "new" && (
            <p className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs leading-relaxed">
              <b className="text-primary">처음 등록하는 교회예요.</b> 아래에 교회 정보를 적어
              주세요.
            </p>
          )}
          {lookup?.kind === "existing" && (
            <p className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs leading-relaxed">
              <b className="block text-sm text-primary">{lookup.churchName}</b>이 교회의 담당자로
              신청합니다. 교회 정보는 이미 등록돼 있어 다시 적지 않아요.
            </p>
          )}
        </Field>

        {isNew && <ChurchFields errors={errors} />}
      </Step>

      <Step
        num={2}
        title="교회 증빙"
        hint="고유번호증 또는 사업자등록증만 인정해요(교회 사칭 방지). 사무용 연락처는 교회 공식 정보와 대조합니다."
        locked={locked}
      >
        <Field label="증빙 서류" required error={errors.doc} group>
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50">
            <span>
              <b className="text-primary">고유번호증</b> 또는{" "}
              <b className="text-primary">사업자등록증</b> 선택
            </span>
            <span className="text-xs">
              {doc
                ? `${doc.name} · ${(doc.size / 1024 / 1024).toFixed(1)}MB`
                : `${DOC_FORMATS_LABEL} · ${DOC_MAX_BYTES / 1024 / 1024}MB 이하`}
            </span>
            <input
              type="file"
              name="doc"
              accept={DOC_ACCEPT}
              className="hidden"
              aria-label="증빙 서류"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                setDoc(picked);
                // 큰 파일은 고르는 순간 알린다 — 서버까지 보내고 거부하면 헛업로드가 된다
                setDocFailure(picked === null ? null : docError(picked));
              }}
            />
          </label>
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="사무용 전화" required error={errors.contactTel}>
            <Input
              name="contactTel"
              placeholder="02-000-0000"
              inputMode="tel"
              maxLength={MAX_LENGTHS.contactTel}
            />
          </Field>
          <Field label="사무용 이메일" optional error={errors.contactEmail}>
            <Input
              name="contactEmail"
              type="email"
              placeholder="office@church.or.kr"
              maxLength={MAX_LENGTHS.contactEmail}
            />
          </Field>
        </div>
      </Step>

      <Step
        num={3}
        title="담당자"
        hint="확인이 필요하면 교회 사무실로 연락해 여쭤봐요. 담당자는 여러 명일 수 있고 각자 인증합니다."
        locked={locked}
      >
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="이름" required error={errors.applicantName}>
            <Input
              name="applicantName"
              defaultValue={defaultName}
              maxLength={MAX_LENGTHS.applicantName}
            />
          </Field>
          <Field label="직분" required error={errors.position}>
            <Choose name="position" labels={POSITIONS} />
          </Field>
        </div>
        {/* 이메일은 로그인 계정을 그대로 쓴다 — Google OAuth로 이미 검증된 값이라 재인증이 없다.
            담당자 개인 전화는 받지 않는다: 사칭자가 자기 번호를 적고 자기가 받으므로 검증이 안 된다 */}
        <Field label="이메일" hint="로그인 계정 이메일이에요. 결과를 이 주소로 알려드려요.">
          <Input value={defaultEmail} type="email" disabled />
        </Field>
      </Step>

      <Step num={4} title="동의" locked={locked}>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="consent"
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
            에 동의합니다. 제출 서류·담당자 정보는 <b>인증 확인 목적으로만</b> 사용하고, 인증 자격이
            유지되는 동안 비공개로 보관해요.
            {/* 무엇에 동의하는지가 화면에 보여야 기록(`verification_consent_version`)이 뜻을 갖는다 */}
            <span className="mt-1 block text-xs text-muted-foreground">
              개인정보처리방침 {PRIVACY_EFFECTIVE_DATE} 시행분
            </span>
          </span>
        </label>
      </Step>

      {/* 파일 오류가 있으면 제출을 막는다 — 안 막으면 플랫폼 한도(4.5MB)를 넘겨 에러 바운더리로 떨어진다 */}
      <Button
        type="submit"
        className="mt-5 h-12 w-full text-sm"
        disabled={locked || submitting || docFailure !== null}
      >
        {submitting ? "제출 중…" : "인증 신청"}
      </Button>
      <p className="mt-3 text-center text-xs leading-relaxed break-keep text-muted-foreground">
        {locked
          ? "고유번호를 확인하면 나머지 항목이 열려요."
          : submitting
            ? "서류를 올리는 중이에요. 창을 닫지 말아 주세요."
            : "신청 후에는 내용을 수정할 수 없어요. 반려되면 사유와 함께 다시 신청할 수 있어요."}
      </p>
    </form>
  );
}

/** 처음 등록하는 교회일 때만 받는 칸 — 기존 교회면 값을 무시하므로 보여주지도 않는다 */
function ChurchFields({ errors }: { errors: FieldErrors }) {
  return (
    <>
      <Field label="교회명" required error={errors.name}>
        <Input name="churchName" placeholder="○○교회" maxLength={MAX_LENGTHS.churchName} />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="교단" required error={errors.denomination}>
          {/* 무소속·독립교회는 DB에서 `null`이다 — `기타`("소속은 있고 우리 9키에 없는 교단")와 뜻이 다르다 */}
          <Choose
            name="denomination"
            labels={DENOMINATIONS}
            extra={{ value: DENOMINATION_INDEPENDENT, label: "무소속·독립교회" }}
          />
        </Field>
        <Field label="지역" required error={errors.region}>
          <Choose name="region" labels={REGIONS} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="시·군·구" required error={errors.city} hint={CITY_HINT}>
          <Input name="city" placeholder={CITY_PLACEHOLDER} maxLength={MAX_LENGTHS.city} />
        </Field>
        <Field label="상세 주소" optional>
          <Input name="address" placeholder={ADDRESS_PLACEHOLDER} maxLength={MAX_LENGTHS.address} />
        </Field>
      </div>
    </>
  );
}

/**
 * 닫힌 라벨 맵 select. **"선택하세요"가 기본값**이다 — 첫 옵션이 자동 선택되면 안 건드린 사람의
 * 교회가 전부 `예장합동`·`서울`·`담임목사`로 저장된다.
 */
function Choose({
  name,
  labels,
  extra,
}: {
  name: string;
  labels: Record<string, string>;
  extra?: { value: string; label: string };
}) {
  return (
    <NativeSelect name={name} defaultValue="" required className="h-11">
      <option value="" disabled>
        선택하세요
      </option>
      {Object.entries(labels).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
      {extra && <option value={extra.value}>{extra.label}</option>}
    </NativeSelect>
  );
}

/** 번호 붙은 단계. `locked`면 흐려지고 내용을 감춘다 — 확인 전에는 받을 칸이 정해지지 않는다 */
function Step({
  num,
  title,
  hint,
  locked,
  children,
}: {
  num: number;
  title: string;
  hint?: string;
  locked?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="border-t py-5 first:border-t-0 first:pt-0">
      <div className={locked ? "opacity-45" : undefined}>
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <span className="flex size-5 items-center justify-center rounded-md bg-primary text-[11px] text-primary-foreground">
            {num}
          </span>
          {title}
        </div>
        {(hint || locked) && (
          <p className="mt-1 ml-7 text-xs leading-relaxed break-keep text-muted-foreground">
            {locked ? "고유번호를 먼저 확인해 주세요." : hint}
          </p>
        )}
      </div>
      {!locked && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}
