"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VERIFICATION_STATUS_VARIANT } from "@/components/admin/verification-row";
import {
  CHURCH_VERIFICATION_STATUSES,
  DENOMINATIONS,
  POSITIONS,
  REGIONS,
  VERIFICATION_DOC_TYPES,
} from "@/constants/domain";
import type { ChurchVerification } from "@/types/domain";

export type SheetState = ChurchVerification | null;

// 교회 인증 검수 시트 — 증빙 확인 후 승인/반려. mock. 실 처리(상태 변경 + updateTag + 알림)는 Phase 1.
export function VerificationSheet({ state, onClose }: { state: SheetState; onClose: () => void }) {
  return (
    <Sheet open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {/* key=id: 다른 신청 열 때 반려 입력 상태 초기화 */}
        {state && <ReviewBody key={state.id} verification={state} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function ReviewBody({
  verification,
  onClose,
}: {
  verification: ChurchVerification;
  onClose: () => void;
}) {
  const { applicant, church, document: doc, status } = verification;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const isPending = status === "PENDING";

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex flex-wrap items-center gap-2 pr-8">
          {church.name}
          <Badge variant={VERIFICATION_STATUS_VARIANT[status]}>
            {CHURCH_VERIFICATION_STATUSES[status]}
          </Badge>
        </SheetTitle>
        <SheetDescription>제출일 {verification.submittedAt}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 px-4">
        <Section title="교회 정보">
          <InfoRow label="교단">{DENOMINATIONS[church.denomination]}</InfoRow>
          <InfoRow label="지역">
            {[REGIONS[church.region], church.city].filter(Boolean).join(" ")}
          </InfoRow>
          <InfoRow label="매칭">{church.id ? "기존 교회" : "신규 교회 생성 신청"}</InfoRow>
        </Section>

        <Section title="담당자">
          <InfoRow label="이름">{applicant.name}</InfoRow>
          <InfoRow label="직분">{POSITIONS[applicant.position]}</InfoRow>
          <InfoRow label="이메일">{applicant.email}</InfoRow>
          <InfoRow label="연락처">{applicant.phone}</InfoRow>
        </Section>

        <Section title="증빙 서류">
          <InfoRow label="종류">{VERIFICATION_DOC_TYPES[doc.type]}</InfoRow>
          <InfoRow label="등록번호">{doc.registrationNumber}</InfoRow>
          {/* 서류 열람 — mock. 실구현은 비공개 Storage signed URL(DATA §3) */}
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:border-primary/40"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{doc.fileName}</span>
            <span className="shrink-0 text-xs font-medium text-primary">서류 보기</span>
          </button>
        </Section>

        {!isPending && (
          <Section title="검수 결과">
            <InfoRow label="검수일">{verification.reviewedAt ?? "—"}</InfoRow>
            {verification.rejectionReason && (
              <p className="rounded-lg bg-destructive/5 px-3 py-2 text-sm break-keep text-destructive">
                {verification.rejectionReason}
              </p>
            )}
          </Section>
        )}

        {isPending && rejecting && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">반려 사유</span>
            <Textarea
              className="min-h-20"
              placeholder="신청자에게 전달할 반려 사유를 적어주세요."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </label>
        )}

        <p className="text-xs break-keep text-muted-foreground">
          승인·반려 처리(상태 변경 + 신청자 알림)는 Phase 1. 지금은 미리보기예요.
        </p>
      </div>

      {isPending && (
        <SheetFooter className="flex-row justify-end">
          {rejecting ? (
            <>
              <Button variant="outline" onClick={() => setRejecting(false)}>
                취소
              </Button>
              <Button variant="destructive" disabled={!reason.trim()} onClick={onClose}>
                반려 확정
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setRejecting(true)}
              >
                반려
              </Button>
              <Button onClick={onClose}>승인</Button>
            </>
          )}
        </SheetFooter>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium break-all">{children}</span>
    </div>
  );
}
