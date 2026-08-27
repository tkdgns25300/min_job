"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 되돌리기 어려운 동작에 한 번 더 묻는 버튼 — **그 자리에서 버튼이 바뀐다.**
//
// 대화상자를 쓰지 않는 이유: 확인만 받는 데 `Dialog`를 들이면(shadcn `alert-dialog` 미설치) 포커스
// 트랩·포털·스크롤 잠금이 딸려 오고, 표의 한 칸에서는 그 무게가 과하다.
//
// ⚠️ **취소 버튼을 옆에 두지 않는다**(2026-08-24 수정). 처음엔 `[마감합니다] [취소]` 두 개를 냈는데
//    표의 관리 칸이 좁아 **줄바꿈되며 행 높이가 흔들렸다**. 지금은 버튼 하나가 자리를 지키며
//    말과 색만 바꾸고, 취소는 **Esc·바깥 클릭**이 받는다 — 자리를 더 먹지 않아 어느 폭에서나 같다.
export function ConfirmButton({
  label,
  confirmLabel,
  hint,
  onConfirm,
  disabled,
  size = "default",
  confirmVariant = "destructive",
  className,
}: {
  /** 평소 버튼에 적히는 말 */
  label: string;
  /** 확인 단계의 말 — 무엇이 일어나는지 다시 말한다(색도 함께 바뀐다) */
  confirmLabel: string;
  /**
   * 확인 단계에 버튼 아래로 낼 한 줄 — **넓은 자리에서만** 쓴다(표 한 칸에서는 생략).
   * 취소 방법은 이 부품이 뒤에 붙인다 — 호출부마다 같은 말을 적지 않게.
   */
  hint?: string;
  onConfirm: () => void;
  disabled?: boolean;
  size?: "default" | "sm";
  /**
   * 확인 단계의 색. 기본은 빨강(마감·삭제)이지만 **되돌리기 어렵다고 다 위험한 것은 아니다** —
   * "다시 모집"은 한 번 더 물을 값어치가 있으면서도 빨강으로 경고할 동작이 아니다(2026-08-26).
   */
  confirmVariant?: "destructive" | "default";
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!asking) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAsking(false);
    };
    // 바깥을 누르면 접는다 — 확인 상태를 붙잡아 두지 않는다. `pointerdown`이라 터치에서도 받는다
    const cancelOnOutside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setAsking(false);
    };
    window.addEventListener("keydown", cancelOnEscape);
    window.addEventListener("pointerdown", cancelOnOutside);
    return () => {
      window.removeEventListener("keydown", cancelOnEscape);
      window.removeEventListener("pointerdown", cancelOnOutside);
    };
  }, [asking]);

  // 처리가 시작되면 확인 상태를 닫는다 — 끝난 뒤 확인 버튼이 남아 있으면 두 번 눌린다
  useEffect(() => {
    if (disabled) setAsking(false);
  }, [disabled]);

  return (
    // 기본은 글자 폭(표 한 칸) · `flex-1`을 받으면 늘어난다(편집 화면의 저장과 1:1)
    <div ref={ref} className={cn("inline-flex flex-col", className)}>
      <Button
        variant={asking ? confirmVariant : "outline"}
        size={size}
        disabled={disabled}
        className="w-full"
        /* 확인 단계의 보이는 말은 짧아야 해서("마감 확인") 보조기기에는 **무슨 동작인지**를 실어
           준다 — `confirmLabel`만으로는 접근성 이름이 문맥을 잃는다. 평소엔 버튼 글자가 이름이다 */
        aria-label={asking ? `${label} — 다시 누르면 실행됩니다` : undefined}
        onClick={() => {
          if (!asking) {
            setAsking(true);
            return;
          }
          setAsking(false);
          onConfirm();
        }}
      >
        {asking ? confirmLabel : label}
      </Button>
      {asking && hint && (
        <p className="mt-1.5 text-xs break-keep text-muted-foreground" role="status">
          {hint} 취소는 Esc.
        </p>
      )}
    </div>
  );
}
