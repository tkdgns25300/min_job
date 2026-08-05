import type { ReactNode } from "react";

// 라벨 위 · 인풋 아래 스택 (모바일 퍼스트 — 데스크톱도 동일, 폼은 좁게 유지가 완성률에 유리)
export function Field({
  label,
  optional,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
        {optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">선택</span>}
      </p>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
