import { churchMetaLine } from "@/lib/format";
import type { Church } from "@/types/domain";

// 공고 폼 위의 교회 요약 — **읽기 전용**이다.
//
// ⛔ **교회 정보를 여기서 고칠 수 없다.** 미검증 값이 인증된 교회를 덮어쓰면 안 된다(인증 신청에서
//    같은 이유로 기존 교회의 칸을 아예 보여주지 않는다). 고치는 곳은 `/mypage/church/info`다.
// ⛔ **직접 입력 칸(`ChurchFields`)을 삭제했다**(2026-08-26). `church`가 `null`일 때 쓰던 분기인데,
//    `JobForm`을 부르는 두 페이지가 모두 `hasChurchAccess` 게이트 뒤에서 `getChurch`(APPROVED만)를
//    넘기므로 **도달하지 않는 코드**였다. 없앤 `/admin/ingest`(운영자 붙여넣기)용 잔재다.
// ⛔ **"정보 수정 문의" 링크도 없앴다**(2026-08-26 · 운영자 결정). 교회가 스스로 고치는 화면이
//    이미 있어(`/mypage/church/info`) 메일로 요청할 이유가 없다.
export function ChurchSummaryCard({ church }: { church: Church }) {
  const meta = churchMetaLine(church);
  return (
    <div className="rounded-xl border bg-muted/30 px-4 py-3">
      <p className="truncate text-sm font-bold">{church.name}</p>
      {meta && <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>}
    </div>
  );
}
