"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// 기기 폭 미리보기 틀 — **`<iframe>` + 자리에 맞춘 축소**.
//
// ① **iframe인 이유**: Tailwind의 반응형 접두사(`sm:`·`md:`·`lg:`)는 **뷰포트**를 본다. 부모 창이
//    1400px일 때 `width:390px` div 안에 공개 화면을 그리면 **데스크톱 레이아웃이 적용된 채
//    찌그러진다**(실측 2026-08-26: 상세 미리보기의 "모집 조건" 표가 두 줄로 깨졌다). iframe은
//    자기 뷰포트를 가지므로 그 안에서는 390px이 진짜 모바일이다.
// ② **축소하는 이유**: 자리가 뷰포트보다 좁을 때만 줄인다(1배가 상한). 폼을 폰으로 보면 자리가
//    좁아 그만큼 줄어든다 — 이게 없으면 미리보기가 잘린다(실측 2026-08-27: 386px 화면에서
//    `scale(0.71)`로 잘림 없이 들어갔다).
//    ⚠️ **데스크톱에서도 정확히 1배는 아니다.** 틀에 `border`가 있고 `box-sizing:border-box`라
//       390px 틀의 **content box는 388px**이고 `contentRect`가 그 값을 준다 → `scale(0.995)`.
//       눈에 보이지 않는 차이라 그대로 둔다(2px을 없애려고 `box-content`로 바꾸면 그만큼이
//       `max-w-full` 밖으로 삐져나가 좁은 화면에서 가로 스크롤이 생긴다).
//    ⚠️ 한때 PC 미리보기(1280px)가 있어 데스크톱에서 **0.51배**로 줄었고 글자가 읽히지 않았다
//       — 그래서 없앴다(근거는 `job-preview.tsx`의 `MOBILE_VIEWPORT`).
//
// ⚠️ **스타일을 옮겨 심는다** — iframe 문서는 부모의 CSS를 물려받지 않는다. `<link>`(배포)와
//    `<style>`(dev의 인라인 주입) 둘 다 복사하고, 디자인 토큰이 `:root`에 있으므로 `<html>`의
//    class·`data-theme`도 함께 옮긴다. HMR로 새로 들어오는 스타일은 따라오지 않는다(미리보기라 무해).
// ⚠️ 높이는 내용에 맞추지 않고 **고정 + 내부 스크롤**이다 — 기기 화면이 그렇고, 내용 높이를 쫓으면
//    타이핑할 때마다 폼이 출렁인다.
export function DeviceFrame({
  viewport,
  height,
  children,
}: {
  /** iframe의 뷰포트 폭(CSS px) — 반응형이 이 값으로 갈린다 */
  viewport: number;
  /** 뷰포트 높이(CSS px) — 축소 전 값이다 */
  height: number;
  children: ReactNode;
}) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [scale, setScale] = useState(1);

  // 자리 폭에 맞춰 줄인다 — 넓힐 일은 없다(1배가 상한)
  useEffect(() => {
    if (!box) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(Math.min(1, entry.contentRect.width / viewport)),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [box, viewport]);

  /**
   * iframe이 붙는 순간 그 문서를 꾸민다 — **ref 콜백에서 한다.** `useState`에 담은 element를
   * effect에서 만지면 React Compiler 린트가 "state에서 파생한 값을 직접 수정한다"고 잡는다
   * (DOM 노드라 실제로는 맞는 조작이지만, 규칙은 그것을 구분하지 못한다).
   */
  const attach = useCallback((node: HTMLIFrameElement | null) => {
    const target = node?.contentDocument;
    if (!target) return;
    // 부모의 스타일시트를 그대로 옮긴다 — 순서를 유지해야 cascade가 같다
    for (const style of document.head.querySelectorAll('link[rel="stylesheet"], style')) {
      target.head.append(style.cloneNode(true));
    }
    // 토큰이 `:root`에 있어 `<html>`의 속성까지 옮겨야 색·폰트가 맞는다(globals.css)
    target.documentElement.className = document.documentElement.className;
    const theme = document.documentElement.dataset.theme;
    if (theme) target.documentElement.dataset.theme = theme;
    target.body.className = "bg-background text-foreground";
    setDoc(target);
  }, []);

  return (
    // 줄인 만큼 자리도 줄여야 아래 여백이 남지 않는다
    <div ref={setBox} className="overflow-hidden" style={{ height: height * scale }}>
      <iframe
        ref={attach}
        title="미리보기"
        // about:blank이라 같은 출처다 — `contentDocument`에 접근할 수 있는 이유
        className="block border-0 bg-background"
        style={{
          width: viewport,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {doc ? createPortal(children, doc.body) : null}
      </iframe>
    </div>
  );
}
