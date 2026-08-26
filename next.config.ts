import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (PPR) 활성화 — 'use cache'/cacheTag/cacheLife 사용 (CLAUDE 아키텍처)
  cacheComponents: true,
  experimental: {
    serverActions: {
      // 교회 인증 증빙 서류가 Server Action 본문으로 올라온다. **기본값 1MB**로는 스캔 PDF·사진이
      // 대부분 거부된다.
      // ⚠️ **4.5MB가 상한이다** — Vercel Function의 요청 본문 한도이고, 넘으면 함수에 닿기도 전에
      //    플랫폼이 `413 FUNCTION_PAYLOAD_TOO_LARGE`를 낸다(공식 문서 `/docs/functions/limitations`).
      //    이 값을 더 올리면 **로컬만 통과하고 배포에서 실패하는** 버그가 생긴다 — 그래서 일부러
      //    플랫폼과 같은 값에 맞춰 개발에서도 같은 벽에 부딪히게 한다.
      //    파일 자체는 `DOC_MAX_BYTES`(4MB)로 막아 폼 나머지 칸이 들어갈 여유를 둔다.
      //    10MB를 정말 받으려면 업로드를 브라우저 → Storage 직행(signed upload URL)으로 옮긴다.
      // ⚠️ **전역 설정이다** — 모든 Server Action에 적용된다. 그래서 이 액션은 칸 길이 상한을
      //    서버에서 직접 본다(`MAX_LENGTHS`).
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
