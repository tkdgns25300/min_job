import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// service-role(secret 키) 클라이언트 — RLS를 우회한다. **공개 cached read 전용**(lib/queries/*).
// ⚠️ 서버 전용 시크릿(브라우저 노출 절대 금지). 쿠키·세션 없음 → 'use cache' 안 깨짐.
// 인증·권한이 필요한 작업엔 절대 쓰지 말 것 — 반드시 server.ts(쿠키 기반, RLS 적용).
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
