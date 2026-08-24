"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ROW_LABELS, type Checks, type RowKey } from "./value-rows";

// 값 한 줄과 섹션 머리 — **읽기가 기본, 고치기는 펼쳐서** 한다.
//
// 왜 이 모양인가: 스무 개 칸을 전부 입력창으로 그려 놓으면 원문(왼쪽)과 대조할 값이 컨트롤에
// 묻혀 "결정할 게 너무 많은" 화면이 된다. 검수의 대부분은 **읽고 넘기는 일**이고 고치는 것은
// 몇 칸뿐이라, 읽는 모양을 기본으로 두고 고칠 때만 컨트롤을 낸다.

/** 줄이 공통으로 받는 것 — 줄마다 두 prop을 따로 적지 않기 위한 묶음 */
export interface RowShared {
  /** 처리된 건은 고칠 수 없다 — "고치기" 버튼째 없앤다(눌러도 되는 것처럼 보이면 안 된다) */
  editable: boolean;
  checks: Checks;
}

/**
 * 값 한 줄. `children`(편집기)이 없으면 읽기 전용 줄이 된다.
 *
 * 펼침 상태를 줄이 스스로 들고 있다 — 부모가 열린 키 목록을 관리하면 줄을 하나 추가할 때마다
 * 키를 등록해야 하고, 그 등록을 잊으면 **열리지 않는 줄**이 조용히 생긴다.
 */
export function ValueRow({
  name,
  label: labelOverride,
  required,
  changed,
  hint,
  editable,
  checks,
  children,
  value,
}: RowShared & {
  name: RowKey;
  /**
   * 라벨 덮어쓰기 — **값에 따라 이름이 바뀌는 칸에만** 쓴다(사역직은 "사례비", 일반직은 "급여" ·
   * `payLabel`이 정본 · DATA §3). ⚠️ 남용하면 `ROW_LABELS`가 라벨의 단일 소스라는 말이 거짓이 된다.
   */
  label?: string;
  /** 승격 필수 6칸 — 비면 승인이 막힌다(lib/review-flags) */
  required?: boolean;
  /** 저장된 값과 달라졌는가 — 접어 둔 뒤에도 손댄 줄을 알아볼 수 있어야 한다 */
  changed?: boolean;
  /** 이 칸을 왜 조심해야 하는가. 펼칠 때만 나온다 — 평소엔 값이 주인공이다 */
  hint?: string;
  children?: ReactNode;
  value: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const canEdit = Boolean(children) && editable;
  const checked = checks.has(name);
  const label = labelOverride ?? ROW_LABELS[name];

  return (
    <div className="border-t border-border/60 first:border-t-0">
      <div className="flex items-start gap-3 py-2">
        <p className="w-16 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground sm:w-20">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </p>
        <div
          className={cn(
            "min-w-0 flex-1 text-sm leading-relaxed break-keep",
            // 확인 표시한 줄은 한 톤 내린다 — 남은 줄이 눈에 남게(지운 것처럼 보이면 안 되므로 취소선 X)
            checked && "text-muted-foreground",
          )}
        >
          {value}
          {changed && <span className="ml-1.5 text-[11px] font-semibold text-primary">고침</span>}
        </div>
        {/* 버튼이 없는 줄(읽기 전용)에도 폭을 잡아 둔다 — 아니면 오른쪽 체크가 줄마다 어긋난다 */}
        <div className="flex w-14 shrink-0 items-start justify-end pt-0.5">
          {canEdit && (
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="text-xs font-semibold text-primary"
              aria-expanded={open}
            >
              {open ? "접기" : "고치기"}
            </button>
          )}
        </div>
        <input
          type="checkbox"
          className="mt-1 size-3.5 shrink-0 accent-primary"
          checked={checked}
          onChange={() => checks.toggle(name)}
          aria-label={`${label} 확인함`}
        />
      </div>
      {open && canEdit && (
        <div className="pb-3 sm:pl-[4.75rem]">
          {hint && (
            <p className="mb-2 text-xs leading-relaxed break-keep text-muted-foreground">{hint}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * 섹션 — **공개 상세 화면의 구획 이름을 그대로** 쓴다(`모집 조건`·`자격 요건`·`지원 방법` 등).
 * 검수용으로 따로 지은 이름("누가 뽑나")을 쓰지 않는 이유: 검수는 "공개되면 이렇게 보인다"를
 * 확인하는 일인데, 화면이 공개 화면과 다른 말로 나누면 머릿속에서 한 번 더 옮겨야 한다.
 */
export function ValueSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      {title && <h3 className="border-b bg-muted/30 px-3 py-1.5 text-xs font-bold">{title}</h3>}
      <div className="px-3 py-1">{children}</div>
    </section>
  );
}

/** 값이 없는 줄 — 필수 칸이면 승인이 막히므로 무게를 달리 준다(그 사실이 여기서 보여야 한다) */
export function Empty({ required }: { required?: boolean }) {
  return (
    <span className={cn(required ? "font-semibold text-destructive" : "text-muted-foreground")}>
      {required ? "비어 있음" : "없음"}
    </span>
  );
}

/** 여러 줄 값(목록 칸) — 같은 문장이 두 번 올 수 있어 인덱스를 key로 쓴다(순서는 고정) */
export function Lines({ items }: { items: string[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item, index) => (
        <li key={index}>· {item}</li>
      ))}
    </ul>
  );
}
