import type { ReactNode } from "react";
import { NativeSelect } from "@/components/ui/native-select";

// 목록 필터용 enum select("○○ 전체" + 도메인 라벨 맵) — 운영자 공고 관리·인증 검수가 같은 블록을
// 6번 복붙하고 있었다. 호출부마다 있던 `as` 캐스트도 여기 한 곳으로 모았다.
//
// value 타입(V)과 라벨 맵 key(K)를 따로 받는다 — 노출 필터처럼 enum에 없는 값("paid")을
// extraOptions로 더하는 화면이 있어 둘이 같지 않다.
export function EnumFilterSelect<V extends string, K extends string>({
  label,
  labels,
  value,
  onChange,
  extraOptions,
}: {
  /** "교단"·"지역" 같은 축 이름만 — "○○ 전체"와 aria-label을 여기서 만든다 */
  label: string;
  labels: Record<K, string>;
  value: V;
  onChange: (value: V) => void;
  /** enum 밖의 추가 선택지 — "전체" 바로 뒤에 온다 */
  extraOptions?: ReactNode;
}) {
  return (
    <NativeSelect
      aria-label={`${label} 필터`}
      className="w-auto"
      value={value}
      onChange={(e) => onChange(e.target.value as V)}
    >
      <option value="all">{label} 전체</option>
      {extraOptions}
      {(Object.entries(labels) as [K, string][]).map(([key, optionLabel]) => (
        <option key={key} value={key}>
          {optionLabel}
        </option>
      ))}
    </NativeSelect>
  );
}
