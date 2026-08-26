"use client";

import { useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DENOMINATIONS, POSITIONS, REGIONS } from "@/constants/domain";
import { REJECTION_REASON_MAX } from "@/lib/church-verification";
import { approveVerification, rejectVerification, type VerifyActionResult } from "../actions";
import type { ChurchVerification } from "@/types/domain";

// 판정 열 — 서류 옆에서 값을 맞춰 보고 승인·반려한다.
//
// **열 전체가 한 client 컴포넌트다.** 맞춰 보기 체크가 판정 바의 경고("맞춰 보지 않은 값 N개")와
// 같은 상태를 봐야 해서, 상태를 한 곳에 두고 안에서 작은 조각으로 나눈다.
//
// ⚠️ **체크는 저장하지 않는다**(새로고침하면 사라진다) — 수집 검수의 확인 체크와 같다. 그리고
//    **막지 않고 알린다**: 강제하면 기계적으로 다 누르고 넘어가 확인의 뜻이 사라진다.
// ⚠️ 승인 게이트를 화면이 판단하지 않는다 — 막는 것은 서버다(액션이 상태를 다시 본다).

/** 서류에서 눈으로 찾을 값 — 신청 유형에 따라 개수가 다르다 */
type MatchRow = { key: string; label: string; value: string; numeric?: boolean };

/**
 * 확인해야 할 것이 유형에 따라 갈린다.
 * - **처음 등록 교회**: 교회 실재부터 — 고유번호·교회명·사무용 전화
 * - **이미 인증된 교회**: 교회는 확인됐으니 **사람만** — 고유번호·사무용 전화
 *   (교회명 대조가 빠진다: 그 교회가 실재하는 것은 이미 확인된 사실이다)
 */
function matchRows(verification: ChurchVerification): MatchRow[] {
  const { church } = verification;
  const known = church.verificationStatus === "APPROVED";
  return [
    { key: "registrationNo", label: "고유번호", value: church.registrationNo, numeric: true },
    ...(known ? [] : [{ key: "name", label: "교회명", value: church.name }]),
    // 전화는 필수값이라 늘 있다 — 타입만 nullable이다
    { key: "contactTel", label: "사무용 전화", value: church.contactTel ?? "—", numeric: true },
  ];
}

export function DecisionPanel({ verification }: { verification: ChurchVerification }) {
  const { applicant, church } = verification;
  const rows = matchRows(verification);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startDecision] = useTransition();

  const toggle = (key: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const run = (action: () => Promise<VerifyActionResult>) =>
    startDecision(async () => {
      setError(null);
      try {
        const result = await action();
        // 성공하면 서버가 큐로 보내므로 이 줄에 오지 않는다 — 실패 모양만 돌아온다
        if (result) setError(result.message);
      } catch (thrown) {
        // 리다이렉트 등 Next 제어 신호는 삼키지 않는다(admin/review와 같은 관용구)
        unstable_rethrow(thrown);
        console.error("[verify] 판정 실패", thrown);
        setError("처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });

  const unchecked = rows.filter((row) => !checked.has(row.key));
  const churchIsKnown = church.verificationStatus === "APPROVED";

  return (
    <div className="flex flex-col">
      <section className="rounded-2xl border border-primary/25 bg-primary/5 p-3.5">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-primary">
          서류와 맞춰 보세요
          <span className="ml-auto font-semibold tabular-nums text-muted-foreground">
            {checked.size}/{rows.length}
          </span>
        </h3>
        {rows.map((row) => (
          <MatchLine
            key={row.key}
            row={row}
            on={checked.has(row.key)}
            onToggle={() => toggle(row.key)}
          />
        ))}
      </section>

      <Group title="신청 정보">
        <Line label="교단">
          {church.denomination ? DENOMINATIONS[church.denomination] : "미상"}
        </Line>
        <Line label="지역">
          {[church.region && REGIONS[church.region], church.city].filter(Boolean).join(" ") ||
            "미상"}
        </Line>
        {/* 고유번호증에 소재지가 적혀 있어 대조에 쓸 수 있다 — 다만 표기가 흔들려 체크 항목으로는 두지 않는다 */}
        <Line label="상세 주소">{church.address ?? "—"}</Line>
        <Line label="사무용 이메일">{church.contactEmail ?? "—"}</Line>
      </Group>

      <Group title="담당자 — 전화로 확인할 사람">
        <Line label="이름 · 직분">{`${applicant.name} · ${POSITIONS[applicant.position]}`}</Line>
        <Line label="이메일">{applicant.email}</Line>
      </Group>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-bold">
          반려 사유
          <span className="ml-1.5 font-normal text-muted-foreground">반려할 때는 필수</span>
        </span>
        <Textarea
          rows={2}
          maxLength={REJECTION_REASON_MAX}
          placeholder="신청자에게 그대로 전달돼요. 무엇을 고쳐야 하는지 적어 주세요."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={pending}
        />
      </label>

      {/* 판정 바 — 서류를 보며 스크롤하므로 버튼이 늘 손에 닿아야 한다 */}
      <div className="sticky bottom-0 mt-4 border-t bg-card/95 pt-3 pb-1 backdrop-blur">
        {error && (
          <p
            className="mb-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            variant="destructive"
            className="flex-1"
            disabled={pending || reason.trim().length === 0}
            onClick={() => run(() => rejectVerification(verification.id, reason))}
          >
            반려
          </Button>
          <Button
            className="flex-1"
            disabled={pending}
            onClick={() => run(() => approveVerification(verification.id))}
          >
            승인
          </Button>
        </div>

        {unchecked.length > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-gold-ink" role="status">
            맞춰 보지 않은 값이 {unchecked.length}개 있습니다 —{" "}
            <b>{unchecked.map((row) => row.label).join(" · ")}</b>
          </p>
        )}
        <p className="mt-1.5 text-xs leading-relaxed break-keep text-muted-foreground">
          {churchIsKnown ? (
            <>
              <b className="text-foreground">교회는 이미 공개돼 있습니다.</b> 승인하면{" "}
              {applicant.name} 담당자에게만 공고 등록 자격이 생깁니다.
            </>
          ) : (
            <>
              승인하면 <b className="text-foreground">교회가 공개되고</b> {applicant.name}{" "}
              담당자에게 공고 등록 자격이 생깁니다.
            </>
          )}{" "}
          반려하면 증빙 서류를 파기합니다.
        </p>
      </div>
    </div>
  );
}

/** 맞춰 볼 값 한 줄 — 값이 커야 서류와 눈으로 대조된다 */
function MatchLine({ row, on, onToggle }: { row: MatchRow; on: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-2.5 border-t border-dashed border-primary/20 py-2 first-of-type:border-t-0">
      <input
        type="checkbox"
        checked={on}
        onChange={onToggle}
        // 감싼 `<label>`이 "고유번호 1234567890"으로 이름을 주므로 `aria-label`을 덧붙이지 않는다 —
        // 덧붙이면 그쪽이 이기면서 **맞춰 볼 값이 이름에서 사라진다**
        className="size-[17px] shrink-0 accent-primary"
      />
      <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{row.label}</span>
      <span
        className={`text-[15px] font-extrabold break-all ${row.numeric ? "tracking-wide tabular-nums" : ""}`}
      >
        {row.value}
      </span>
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1.5 text-xs font-bold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5 text-[13px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-semibold break-all">{children}</span>
    </div>
  );
}
