import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  CHURCH_STATUSES,
  CHURCH_VERIFICATION_STATUSES,
  DENOMINATIONS,
  POSITIONS,
  REGIONS,
  type ChurchVerificationStatus,
} from "@/constants/domain";
import { formatKstDate } from "@/lib/format";
import type { ChurchVerification } from "@/types/domain";

// 인증 상태 → Badge variant. 판정 페이지(`[id]/page.tsx`)와 공유(단일 정의) — 표시 로직이라
// 도메인 enum과 분리한다.
export const VERIFICATION_STATUS_VARIANT: Record<
  ChurchVerificationStatus,
  "default" | "outline" | "destructive"
> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
};

export function VerificationRow({ verification }: { verification: ChurchVerification }) {
  const { applicant, church, status } = verification;
  // 기존 교회를 고른 신청은 교단·지역이 미상일 수 있다 — 아는 조각만 잇는다
  const location = [
    church.denomination && DENOMINATIONS[church.denomination],
    church.region && REGIONS[church.region],
    church.city,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold">{church.name}</span>
          {/* 아직 검증 안 된 교회 — 실재 여부부터 확인해야 한다.
              "신규"라고 쓰지 않는다: 반려 뒤 재신청도 같은 PENDING 행을 다시 쓰므로 처음이 아닐 수 있다 */}
          {church.verificationStatus !== "APPROVED" && (
            <Badge variant="secondary" className="font-medium">
              {CHURCH_STATUSES.PENDING}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{location}</div>
      </td>
      <td className="px-4 py-3 align-middle whitespace-nowrap">
        {applicant.name}
        <span className="ml-1.5 text-xs text-muted-foreground">
          {POSITIONS[applicant.position]}
        </span>
      </td>
      {/* 검수의 축이라 목록에서 바로 보인다(공개 게시판 공고와 대조).
          전화를 먼저 보여준다 — 신청 필수값이고, 공고에도 전화만 공개된 교회가 흔해 대조가 잘 된다 */}
      <td className="px-4 py-3 align-middle text-xs whitespace-nowrap text-muted-foreground">
        {church.contactTel ?? church.contactEmail ?? "—"}
      </td>
      <td className="px-4 py-3 align-middle text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {formatKstDate(verification.submittedAt)}
      </td>
      <td className="px-4 py-3 align-middle">
        <Badge variant={VERIFICATION_STATUS_VARIANT[status]}>
          {CHURCH_VERIFICATION_STATUSES[status]}
        </Badge>
      </td>
      <td className="px-4 py-3 align-middle">
        {/* 시트가 아니라 판정 페이지로 간다 — 증빙 서류를 읽을 폭이 필요해서다(그 페이지 머리말) */}
        <div className="flex justify-end">
          <Link
            href={`/admin/verify/${verification.id}`}
            className={buttonVariants({
              variant: status === "PENDING" ? "default" : "outline",
              size: "sm",
            })}
          >
            {status === "PENDING" ? "검토" : "상세"}
          </Link>
        </div>
      </td>
    </tr>
  );
}
