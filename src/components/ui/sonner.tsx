"use client";

import * as React from "react";
import { CircleCheckIcon, OctagonXIcon } from "lucide-react";
import { Toaster as Sonner, toast as sonnerToast, type ToasterProps } from "sonner";

// 알림 토스트 그릇 — 루트 레이아웃에 **한 번만** 심는다(`app/layout.tsx`).
//
// ⚠️ **`toast`도 이 파일을 거쳐 쓴다**(아래 재수출). 부르는 쪽이 `sonner`를 직접 import하면
//    벤더가 화면 코드로 새고, `@base-ui/react`를 `ui/` 밖에서 쓰지 않는 이 저장소의 규칙과
//    어긋난다(실측: Base UI는 `ui/`에서만 import된다).
// ⚠️ **성공만 토스트다.** 실패는 화면에 남는 인라인 문구로 말한다 — 읽고 조치해야 하는 말이라
//    4초 뒤 사라지면 안 되고, `role="alert"`의 assertive 안내를 잃는다(sonner의 라이브 영역은
//    polite 고정이다). 예외는 대안이 없던 자리 하나뿐이다(링크 복사 실패).
//
// ⚠️ **shadcn 원본에서 고친 곳**(`ui/`는 원본을 두는 곳이라 무엇을 왜 바꿨는지 남긴다):
//   ① **`next-themes`를 뺐다.** 원본은 `useTheme()`로 테마를 따라가는데 이 프로젝트는
//      **라이트 전용**이고(`globals.css` 머리말) Provider도 없다 → `useTheme()`이 `"system"`을
//      돌려주므로 그대로 두면 **다크 OS 사용자에게 밝은 앱 위 검은 토스트**가 뜬다.
//      `theme="light"`로 못 박고 의존성은 제거했다(쓰는 곳이 여기뿐이었다).
//      참고로 sonner 자체 기본값도 `light`라, 이 prop은 확인 사살이다.
//   ② **`icons`를 성공·실패 둘로 줄였다.** 원본은 info·warning·loading까지 다섯이다.
//      ⚠️ 줄여도 `toast.info()`가 막히지는 않는다 — sonner 자체 SVG로 떨어져 **lucide와 다른
//         글꼴의 아이콘**이 나온다. 그래서 아래 재수출을 두 함수로 좁혀 컴파일 단계에서 막는다.
//   ③ **`toastOptions.classNames.toast = "cn-toast"`와 `className="toaster group"`을 뺐다** —
//      둘 다 이 저장소에 대응 규칙이 없다(`globals.css`·sonner CSS 어디에도 없다).
//   ④ 원본은 `const Toaster = (...) => {}`에 React import가 없었다 — `ui/`의 다른 부품들처럼
//      `function` 선언 + 명시 import로 맞췄다.
//
// ⚠️ **위치는 우상단이고, 헤더 높이만큼 내린다.** 하단은 `sticky bottom-0` 액션 바 세 곳
//    (수집 검수·공고 편집·인증 판정)과 겹쳐 운영자가 누르는 버튼을 가린다. 그런데 위쪽에도
//    `sticky top-0`인 공개 헤더(`h-16` = 64px)가 있어, 그냥 두면 토스트가 **계정 영역을 4초간
//    덮는다** — `offset`으로 그만큼 비켜 세운다.
// ⚠️ 색은 토큰에서 온다(`--popover`·`--border`·`--radius`). 여기서 색을 새로 정하지 않는다.
//    ⚠️ **실패 토스트의 배경·테두리는 성공과 같다** — sonner의 `--error-*`는 `richColors`를
//       켠 경우에만 읽히고, 우리는 켜지 않았다(빨간 면을 쓰려면 `--destructive-foreground`가
//       필요한데 토큰에 없다). 실패 신호는 **아이콘 색**으로 준다. 실패가 토스트로 오는 자리가
//       하나뿐이라 이 정도로 충분하다(위 ⚠️ 참조).
// ⚠️ 이 부품은 루트에 있어 **공개 페이지에도 실려 나간다**(측정 10.6KB gz + CSS 3.3KB).
//    그룹별로 나눠 심으면 아낄 수 있지만, 로그아웃처럼 **그룹을 넘는 이동**이 있어 그릇이 하나여야
//    한다 — 레이아웃 셋에 복제하는 것보다 이 비용을 택했다.
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      containerAriaLabel="알림"
      offset={{ top: "5rem", right: "1.5rem" }}
      mobileOffset={{ top: "4.5rem", right: "1rem" }}
      icons={{
        success: <CircleCheckIcon className="size-4 text-primary" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

/**
 * 호출부가 쓰는 두 함수 — **좁혀서 내보낸다.** `sonner`의 `toast`를 통째로 재수출하면
 * `info`·`warning`·`loading`이 열리고, 그것들은 위 ②의 이유로 **다른 글꼴 아이콘**이 나온다.
 * 여기서 막으면 컴파일 단계에서 걸린다.
 * ⚠️ 메시지는 **문자열 한 줄**만 받는다 — 설명 줄을 붙이면 4초 안에 다 읽지 못한다(목업 결정).
 */
export const toast = {
  success: (message: string) => sonnerToast.success(message),
  error: (message: string) => sonnerToast.error(message),
};

export { Toaster };
