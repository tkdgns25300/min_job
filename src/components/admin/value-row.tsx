"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// 값 한 줄과 구획 머리 — **읽기가 기본, 고치기는 펼쳐서** 한다.
//
// 왜 이 모양인가: 스무 개 칸을 전부 입력창으로 그려 놓으면 대조할 값이 컨트롤에 묻혀 "결정할 게
// 너무 많은" 화면이 된다. 값을 보는 일이 대부분이고 고치는 것은 몇 칸뿐이라, 읽는 모양을 기본으로
// 두고 고칠 때만 컨트롤을 낸다. 수집 검수(`/admin/review/[id]`)에서 만들었고 공고 관리
// (`/admin/jobs/[id]`)가 같은 문제를 갖고 있어 여기로 올렸다(CLAUDE.md 배치 규칙).
//
// ⚠️ **도메인을 모른다.** 라벨·값·편집기를 전부 prop으로 받는다 — 어느 테이블의 어느 칸인지,
//    무엇이 필수인지는 부르는 화면이 안다(검수는 `review_data`, 공고 관리는 `jobs`이고 제약이 다르다).

/** 확인 표시 — 쓰는 화면만 넘긴다(안 넘기면 체크박스가 아예 없다) */
export interface RowCheck {
  checked: boolean;
  onToggle: () => void;
}

/**
 * 값 한 줄. `children`(편집기)이 없으면 읽기 전용 줄이 된다.
 *
 * 펼침 상태를 줄이 스스로 들고 있다 — 부모가 열린 키 목록을 관리하면 줄을 하나 추가할 때마다
 * 키를 등록해야 하고, 그 등록을 잊으면 **열리지 않는 줄**이 조용히 생긴다.
 */
export function ValueRow({
  label,
  value,
  required,
  changed,
  hint,
  editable = true,
  check,
  children,
}: {
  label: string;
  value: ReactNode;
  /** 비면 저장·승인이 막히는 칸 — 무게를 달리 준다(막히는 규칙은 부르는 쪽이 안다) */
  required?: boolean;
  /** 저장된 값과 달라졌는가 — 접어 둔 뒤에도 손댄 줄을 알아볼 수 있어야 한다 */
  changed?: boolean;
  /** 이 칸을 왜 조심해야 하는가. 펼칠 때만 나온다 — 평소엔 값이 주인공이다 */
  hint?: string;
  /** 고칠 수 없는 상태(처리된 건 등)면 "고치기" 버튼째 없앤다 — 눌러도 되는 것처럼 보이면 안 된다 */
  editable?: boolean;
  check?: RowCheck;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const canEdit = Boolean(children) && editable;

  return (
    <div className="border-t border-border/60 first:border-t-0">
      <div className="flex items-start gap-3 py-2">
        <p className="w-16 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground sm:w-20">
          {label}
          {/* 붉은 별을 쓰지 않는다 — 여섯 줄에 걸리면 산만하고, 실제로 막히는 순간은 값 자리의
              "비어 있음"과 아래 판정 바가 훨씬 크게 말한다 */}
          {required && <span className="ml-0.5 text-muted-foreground/70">*</span>}
        </p>
        <div
          className={cn(
            "min-w-0 flex-1 text-sm leading-relaxed break-keep",
            // 확인 표시한 줄은 한 톤 내린다 — 남은 줄이 눈에 남게(지운 것처럼 보이면 안 되므로 취소선 X)
            check?.checked && "text-muted-foreground",
          )}
        >
          {value}
          {changed && <span className="ml-1.5 text-[11px] font-semibold text-primary">고침</span>}
        </div>
        {/* 버튼이 없는 줄(읽기 전용)에도 폭을 잡아 둔다 — 아니면 오른쪽 끝이 줄마다 어긋난다 */}
        <div className="flex w-14 shrink-0 items-start justify-end pt-0.5">
          {canEdit && (
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className={cn(
                "text-xs transition-colors",
                // 줄마다 반복되는 말이라 평소엔 배경으로 물러난다 — 손을 얹거나 키보드로 오면 살아난다
                open
                  ? "font-semibold text-primary"
                  : "text-muted-foreground hover:text-primary focus-visible:text-primary",
              )}
              aria-expanded={open}
            >
              {open ? "접기" : "고치기"}
            </button>
          )}
        </div>
        {check && (
          <input
            type="checkbox"
            className="mt-1 size-3.5 shrink-0 accent-primary"
            checked={check.checked}
            onChange={check.onToggle}
            aria-label={`${label} 확인함`}
          />
        )}
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
 * 구획 — **공개 상세 화면의 구획 이름을 그대로** 쓴다(`모집 조건`·`자격 요건`·`지원 방법` 등).
 * 운영자용으로 따로 지은 이름("누가 뽑나")을 쓰지 않는 이유: 두 화면 모두 "공개되면 이렇게 보인다"를
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

/** 값이 없는 줄 — 필수 칸이면 저장이 막히므로 무게를 달리 준다(그 사실이 여기서 보여야 한다) */
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
