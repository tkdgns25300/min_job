"use client";

import { useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { MAX_LENGTHS, type CheckItem } from "@/lib/job-draft";
import { Button } from "@/components/ui/button";

// 항목 모양은 `lib/job-draft`가 정본이다 — 여기 한 벌 더 두면 폼·액션·이 부품이 갈린다.
export type { CheckItem };

// 프리셋 체크 + 직접 추가 리스트. 프리셋을 원탭으로 담고, 없는 항목은 직접 추가.
// withRequired면 담긴 항목별로 필수/선택을 지정한다(제출 서류).
export function CheckList({
  presets,
  items,
  onChange,
  withRequired = false,
  addPlaceholder,
}: {
  presets: readonly string[];
  items: CheckItem[];
  onChange: (items: CheckItem[]) => void;
  withRequired?: boolean;
  addPlaceholder: string;
}) {
  const [draft, setDraft] = useState("");

  const isOn = (name: string) => items.some((i) => i.name === name);
  const customs = items.filter((i) => !presets.includes(i.name));

  const toggle = (name: string) =>
    onChange(
      isOn(name) ? items.filter((i) => i.name !== name) : [...items, { name, required: true }],
    );
  const setRequired = (name: string, required: boolean) =>
    onChange(items.map((i) => (i.name === name ? { ...i, required } : i)));
  const add = () => {
    const value = draft.trim();
    if (!value || isOn(value)) return;
    onChange([...items, { name: value, required: true }]);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return; // 한글 IME 조합 확정 Enter 무시
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  // 프리셋 먼저, 그다음 직접 추가한 커스텀 항목
  const rows = [...presets, ...customs.map((i) => i.name)];

  return (
    <div className="space-y-1">
      {rows.map((name) => {
        const on = isOn(name);
        const item = items.find((i) => i.name === name);
        return (
          <div key={name} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={name}
              onClick={() => toggle(name)}
              className={cn(
                // 보이는 상자는 18px, 누르는 영역은 ::before로 34px — 폰에서 18px은 맞추기 어렵다(전수 점검 2026-09-05)
                "relative flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors before:absolute before:-inset-2 before:content-['']",
                on ? "border-primary bg-primary text-primary-foreground" : "border-input",
              )}
            >
              {on && <Check className="size-3" />}
            </button>
            {/* 이름을 눌러도 토글된다 — 상자만 누르게 두면 폰에서 절반은 빗나간다. 접근성 이름은 위 버튼이 맡는다 */}
            <span
              onClick={() => toggle(name)}
              className={cn(
                "min-w-0 flex-1 cursor-pointer text-sm break-keep select-none",
                on ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {name}
            </span>
            {withRequired && on && item && (
              <div className="flex shrink-0 overflow-hidden rounded-md border text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setRequired(name, true)}
                  className={cn(
                    "px-2.5 py-1 transition-colors",
                    item.required ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  필수
                </button>
                <button
                  type="button"
                  onClick={() => setRequired(name, false)}
                  className={cn(
                    "px-2.5 py-1 transition-colors",
                    item.required ? "text-muted-foreground" : "bg-muted text-foreground",
                  )}
                >
                  선택
                </button>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex gap-2 pt-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={addPlaceholder}
          // 상한은 `job-draft`의 `items()`가 저장 직전에도 자른다 — 여기서 막아야 그 자름이
          // **사용자 눈앞에서** 일어난다(`list-field`와 같은 이유)
          maxLength={MAX_LENGTHS.item}
          className="h-9"
        />
        <Button type="button" variant="outline" size="lg" onClick={add}>
          추가
        </Button>
      </div>
    </div>
  );
}
