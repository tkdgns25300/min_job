import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/auth";
import { getCurrentUser } from "@/lib/queries/users";
import { signInWithGoogle } from "./actions";
import { SubmitButton } from "./submit-button";

// 구글 간편 로그인 폼 — **서버 컴포넌트**.
// ⚠️ next·error를 client에서 `useSearchParams`로 읽으면 안 된다: 그 서브트리가 클라이언트로
//    밀려나(CSR bail) JS가 없을 때 버튼 자체가 없는 페이지가 된다 → 서버에서 읽어 렌더한다.
// <form action={serverAction}>은 JS 없이도 POST로 동작한다(점진적 향상).
// 세션·searchParams를 읽으므로 호출부(page)가 <Suspense>로 감싼다.
export async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext = safeInternalPath(next ?? null);

  // 이미 로그인한 사용자에게 로그인 화면을 보여줄 이유가 없다.
  // 특히 콜백 성공 후 뒤로가기로 code가 재사용되면 "로그인에 실패했어요"가 뜨는데,
  // 그때 세션은 멀쩡하므로 그냥 복귀 경로로 보내는 것이 맞다.
  if (await getCurrentUser()) redirect(safeNext);

  return (
    <form action={signInWithGoogle} className="space-y-2.5">
      {/* 게이트가 붙인 복귀 경로를 그대로 실어 보낸다 — 검증(safeInternalPath)은 서버에서 */}
      {next && <input type="hidden" name="next" value={next} />}
      <SubmitButton />
      {error !== undefined && (
        <p className="text-xs text-destructive" role="alert">
          로그인에 실패했어요. 다시 시도해 주세요.
        </p>
      )}
    </form>
  );
}
