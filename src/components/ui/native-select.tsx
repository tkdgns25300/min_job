import * as React from "react";

import { cn } from "@/lib/utils";

// 기본 <select> — 팝업형 Base UI Select 대신 접근성 좋은 네이티브 select에 Input과 동일 시각문법.
// 높이·너비(필터바는 w-auto) 등 변형은 className으로.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
