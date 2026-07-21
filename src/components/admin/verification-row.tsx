"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CHURCH_VERIFICATION_STATUSES,
  DENOMINATIONS,
  POSITIONS,
  REGIONS,
  VERIFICATION_DOC_TYPES,
  type ChurchVerificationStatus,
} from "@/constants/domain";
import type { ChurchVerification } from "@/types/domain";

// 인증 상태 → Badge variant. sheet와 공유(단일 정의) — 표시 로직이라 도메인 enum과 분리.
export const VERIFICATION_STATUS_VARIANT: Record<
  ChurchVerificationStatus,
  "default" | "outline" | "destructive"
> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
};

export function VerificationRow({
  verification,
  onReview,
}: {
  verification: ChurchVerification;
  onReview: () => void;
}) {
  const { applicant, church, document: doc, status } = verification;
  const location = [DENOMINATIONS[church.denomination], REGIONS[church.region], church.city]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold">{church.name}</span>
          {/* 신규 교회 생성 신청 — 기존 교회 매칭 없음(추가 확인 필요) */}
          {church.id === null && (
            <Badge variant="secondary" className="font-medium">
              신규
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{location}</div>
      </td>
      <td className="px-4 py-3 align-middle whitespace-nowrap">
        {applicant.name}
        <span className="ml-1.5 text-xs text-muted-foreground">{POSITIONS[applicant.position]}</span>
      </td>
      <td className="px-4 py-3 align-middle text-xs whitespace-nowrap text-muted-foreground">
        {VERIFICATION_DOC_TYPES[doc.type]}
      </td>
      <td className="px-4 py-3 align-middle text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {verification.submittedAt}
      </td>
      <td className="px-4 py-3 align-middle">
        <Badge variant={VERIFICATION_STATUS_VARIANT[status]}>
          {CHURCH_VERIFICATION_STATUSES[status]}
        </Badge>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex justify-end">
          <Button
            variant={status === "PENDING" ? "default" : "outline"}
            size="sm"
            onClick={onReview}
          >
            {status === "PENDING" ? "검토" : "상세"}
          </Button>
        </div>
      </td>
    </tr>
  );
}
