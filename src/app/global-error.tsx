"use client";

import { useEffect } from "react";

// 루트 레이아웃 자체에서 발생한 에러의 최후 방어선 — error.tsx가 잡지 못하는 유일한 경우.
// 루트 레이아웃을 대체하므로 자체 <html>/<body>가 필요하고, globals.css(Tailwind)가 로드되지
// 않을 수 있어 브랜드 토큰을 인라인 스타일로 직접 지정해 안전하게 렌더한다.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "2rem",
          textAlign: "center",
          background: "#15332a",
          color: "#ffffff",
          fontFamily:
            "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
        }}
      >
        <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.01em" }}>
          <span style={{ color: "#d3ad63" }}>Min</span>Job
        </p>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>문제가 생겼어요</h1>
        <p
          style={{ margin: 0, maxWidth: "28rem", lineHeight: 1.6, color: "rgba(255,255,255,0.7)" }}
        >
          잠시 후 다시 시도해 주세요. 문제가 계속되면 조금 뒤에 다시 방문해 주세요.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "0.5rem",
            borderRadius: "0.75rem",
            border: "none",
            background: "#ffffff",
            color: "#2f5d50",
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
