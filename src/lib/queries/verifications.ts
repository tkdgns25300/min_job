import * as mock from "@/mocks";
import type { ChurchVerification } from "@/types/domain";

// 데이터 소스 seam (교회 인증) — 페이지는 여기서만 가져온다.
// ⚠️ 인증 의존(operator 전용) + PII(담당자 실명·직분·이메일) — 'use cache' 금지(users.ts 선례, 가드레일 #3).
//   공개 공고(jobs)와 달리 캐시 이득 없고 개인정보를 공유 캐시에 두는 위험만 있다.
// 실구현은 operator RLS + 쿠키 세션 기반 server.ts 호출로 교체(시그니처·타입 동일). 현재 mock 위임.
export async function getVerifications(): Promise<ChurchVerification[]> {
  return mock.getVerifications();
}
