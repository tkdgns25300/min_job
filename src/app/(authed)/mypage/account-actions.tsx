import { signOut } from "./actions";
import { contactMailto } from "@/constants/business";

// 계정 유틸 — 로그아웃(실 세션 해제) / 회원탈퇴 안내.
// ⚠️ 회원탈퇴 자동 처리는 계정·연관 데이터 삭제까지 필요해 아직 미구현. "모두 삭제됩니다"라고 적어두고
// 실제로는 로그아웃만 하면 사용자를 속이므로, 약관·개인정보처리방침이 보장하는 탈퇴 권리를
// 실제로 행사할 수 있게 운영자 문의 경로를 남긴다.
// 훅·상태가 없어 서버 컴포넌트 — 로그아웃은 Server Action 폼으로 처리한다.
export function AccountActions() {
  return (
    <div className="space-y-2">
      {/* 로그아웃 — 일반 행(빨강 텍스트) */}
      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center rounded-xl border p-4 text-sm font-semibold text-destructive transition-colors hover:bg-muted"
        >
          로그아웃
        </button>
      </form>

      {/* 회원탈퇴 — 자동 처리 미구현이라 위험 버튼 대신 실제 처리 경로를 안내 */}
      <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
        <p className="text-sm font-bold text-destructive">회원탈퇴</p>
        <p className="mt-0.5 text-xs leading-relaxed break-keep text-muted-foreground">
          계정·저장한 공고·교회 인증 정보를 완전히 지우는 자동 탈퇴는 준비 중이에요. 지금은{" "}
          <a
            href={contactMailto("[민잡] 회원탈퇴 요청")}
            className="font-semibold text-foreground underline"
          >
            운영자에게 탈퇴 요청
          </a>
          하시면 확인 후 처리해 드려요.
        </p>
      </div>
    </div>
  );
}
