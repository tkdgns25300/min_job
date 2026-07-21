"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { VerificationRow } from "@/components/admin/verification-row";
import {
  VerificationSheet,
  type SheetState,
} from "@/components/admin/verification-sheet";
import {
  CHURCH_VERIFICATION_STATUSES,
  DENOMINATIONS,
  REGIONS,
  type ChurchVerificationStatus,
  type Denomination,
  type Region,
} from "@/constants/domain";
import type { ChurchVerification } from "@/types/domain";

// 검수 대기(PENDING)를 첫 탭으로 — 유일한 검수 게이트라 대기 처리가 핵심 작업.
type Tab = ChurchVerificationStatus | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "PENDING", label: CHURCH_VERIFICATION_STATUSES.PENDING },
  { key: "APPROVED", label: CHURCH_VERIFICATION_STATUSES.APPROVED },
  { key: "REJECTED", label: CHURCH_VERIFICATION_STATUSES.REJECTED },
  { key: "all", label: "전체" },
];

export function AdminVerifyView({ verifications }: { verifications: ChurchVerification[] }) {
  const [tab, setTab] = useState<Tab>("PENDING");
  const [denom, setDenom] = useState<"all" | Denomination>("all");
  const [region, setRegion] = useState<"all" | Region>("all");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);

  const counts = useMemo(
    () => ({
      all: verifications.length,
      PENDING: verifications.filter((v) => v.status === "PENDING").length,
      APPROVED: verifications.filter((v) => v.status === "APPROVED").length,
      REJECTED: verifications.filter((v) => v.status === "REJECTED").length,
    }),
    [verifications],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return verifications.filter((v) => {
      if (tab !== "all" && v.status !== tab) return false;
      if (denom !== "all" && v.church.denomination !== denom) return false;
      if (region !== "all" && v.church.region !== region) return false;
      if (query && !`${v.church.name} ${v.applicant.name}`.toLowerCase().includes(query))
        return false;
      return true;
    });
  }, [verifications, tab, denom, region, q]);

  return (
    <div>
      {/* 탭 (상태별) */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(({ key, label }) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "relative -mb-px flex items-center gap-1.5 px-3 py-2 text-sm font-bold whitespace-nowrap",
                on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                  on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[key]}
              </span>
              {on && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
            </button>
          );
        })}
      </div>

      {/* 필터 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="교단 필터"
          className="w-auto"
          value={denom}
          onChange={(e) => setDenom(e.target.value as "all" | Denomination)}
        >
          <option value="all">교단 전체</option>
          {Object.entries(DENOMINATIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="지역 필터"
          className="w-auto"
          value={region}
          onChange={(e) => setRegion(e.target.value as "all" | Region)}
        >
          <option value="all">지역 전체</option>
          {Object.entries(REGIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <Input
          className="h-9 min-w-40 flex-1"
          placeholder="교회·담당자 검색"
          aria-label="인증 신청 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* 테이블 */}
      <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            조건에 맞는 인증 신청이 없어요.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">교회</th>
                <th className="px-4 py-2.5 font-medium">담당자</th>
                <th className="px-4 py-2.5 font-medium">증빙</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">제출일</th>
                <th className="px-4 py-2.5 font-medium">상태</th>
                <th className="px-4 py-2.5 text-right font-medium">검수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => (
                <VerificationRow key={v.id} verification={v} onReview={() => setSheet(v)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <VerificationSheet state={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}
