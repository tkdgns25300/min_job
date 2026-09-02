import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 순수 함수 단위 테스트 — 돈이 걸린 판정(정원·금액·주 경계)과 자리 규칙(비슷한 공고·광고 로우)을 고정한다.
// 컴포넌트·DB는 테스트하지 않는다(실브라우저 E2E가 맡는다).
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
