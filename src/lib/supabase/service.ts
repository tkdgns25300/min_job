import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// service-role(secret 키) 클라이언트 — RLS를 우회한다. **공개 cached read 전용**(lib/queries/*).
// ⚠️ 서버 전용 시크릿(브라우저 노출 절대 금지). 쿠키·세션 없음 → 'use cache' 안 깨짐.
// 인증·권한이 필요한 작업엔 쓰지 말 것 — 반드시 server.ts(쿠키 기반, RLS 적용).
//
// ⚠️ **예외 2개 — 비공개 Storage.** `storage.objects`는 RLS가 **항상** 켜져 있고 우리 버킷엔
//    정책이 없어(RLS 유예) publishable 키로는 서명·업로드가 조용히 실패한다(실측).
//    ① 검수 포스터 signed URL(`lib/queries/review.ts`) — 운영자 게이트 뒤의 **읽기**.
//    ② 교회 인증 증빙 업로드·삭제(`mypage/verify/actions.ts`) — 일반 로그인 사용자가 트리거하는
//       **쓰기**. 그래서 경로에 사용자 입력을 넣지 않고(`{user.id}/{uuid}.{ext}`) `upsert:false`로
//       덮어쓰기를 막는다. 크기·MIME은 버킷 설정이 한 번 더 거른다.
//    **이 예외를 늘리지 말 것** — 근거와 방어는 CLAUDE.md의 Supabase 규칙 절에 있다.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
