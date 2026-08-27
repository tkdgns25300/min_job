"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_LENGTHS } from "@/lib/job-draft";

// 항목 리스트 입력(줄 추가/삭제) — 자격요건·우대사항·제출서류 공용.
// presets = 자주 쓰는 항목 원탭 추가 칩 (추천 검색어 칩과 같은 옅은 초록 면 문법)
export function ListField({
  items,
  onChange,
  placeholder,
  presets = [],
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  presets?: readonly string[];
}) {
  const [draft, setDraft] = useState("");

  const add = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed]);
  };
  const submitDraft = () => {
    add(draft);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return; // 한글 IME 조합 확정 Enter 무시
    if (e.key === "Enter") {
      e.preventDefault(); // 폼 제출 방지 — Enter는 항목 추가
      submitDraft();
    }
  };
  const remainingPresets = presets.filter((preset) => !items.includes(preset));

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 break-keep">{item}</span>
              <button
                type="button"
                aria-label={`${item} 삭제`}
                onClick={() => onChange(items.filter((x) => x !== item))}
                className="shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {remainingPresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remainingPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => add(preset)}
              className="rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-1 text-xs text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
            >
              + {preset}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          // 상한은 `job-draft`의 `items()`가 저장 직전에도 자른다 — 여기서 막아야 그 자름이
          // **사용자 눈앞에서** 일어난다(안 막으면 80자를 적어도 60자만 조용히 저장된다)
          maxLength={MAX_LENGTHS.item}
          className="h-9"
        />
        <Button type="button" variant="outline" size="lg" onClick={submitDraft}>
          추가
        </Button>
      </div>
    </div>
  );
}
