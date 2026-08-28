import { signOut } from "./actions";
import { contactMailto } from "@/constants/business";

// 계정 유틸 — 로그아웃(실 세션 해제) / 회원탈퇴 안내.
// ⚠️ 회원탈퇴 자동 처리는 계정·연관 데이터 삭제까지 필요해 아직 미구현. "모두 삭제됩니다"라고 적어두고
// 실제로는 로그아웃만 하면 사용자를 속이므로, 약관·개인정보처리방침이 보장하는 탈퇴 권리를
// 실제로 행사할 수 있게 운영자 문의 경로를 남긴다.
// ⚠️ **탈퇴 안내는 한 줄이다**(2026-08-28). 한때 빨간 테두리 상자였는데 로그아웃 버튼보다 커서,
//    준비 중인 것이 이 화면에서 가장 무거웠다. 경로(메일 링크)는 그대로고 무게만 내렸다.
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

      <p className="px-1 text-xs leading-relaxed break-keep text-muted-foreground">
        회원탈퇴는 운영자 확인 후 처리해요 —{" "}
        <a
          href={contactMailto("[민잡] 회원탈퇴 요청")}
          className="font-semibold text-foreground underline"
        >
          탈퇴 요청하기
        </a>
      </p>
    </div>
  );
}
