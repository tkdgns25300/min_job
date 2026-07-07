import type { ReactNode } from "react";

// 폼 섹션 — 상세 페이지 Section과 같은 문법: 흰 면 하나에서 제목+구분선으로 흐름(카드 남발 금지)
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 border-t pt-6 first:mt-0 first:border-t-0 first:pt-0">
      <h2 className="text-base font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

// 라벨 위 · 인풋 아래 스택 (모바일 퍼스트 — 데스크톱도 동일, 폼은 좁게 유지가 완성률에 유리)
export function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">선택</span>}
      </p>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
