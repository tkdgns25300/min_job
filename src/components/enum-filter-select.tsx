import { NativeSelect } from "@/components/ui/native-select";

// 목록 필터용 enum select("○○ 전체" + 도메인 라벨 맵) — 운영자 공고 관리·인증 검수가 같은 블록을
// 6번 복붙하고 있었다. 호출부마다 있던 `as` 캐스트도 여기 한 곳으로 모았다.
//
// 값은 **"all" 아니면 라벨 맵의 key**다 — 선택지에 없는 값을 상태로 들 수 없게 타입으로 막는다.
// (한때 enum 밖의 값을 더하는 `extraOptions`가 있었지만, 그걸 쓰던 노출 필터를 걷어내면서 없앴다)
export function EnumFilterSelect<K extends string>({
  label,
  labels,
  value,
  onChange,
}: {
  /** "교단"·"지역" 같은 축 이름만 — "○○ 전체"와 aria-label을 여기서 만든다 */
  label: string;
  labels: Record<K, string>;
  value: "all" | K;
  onChange: (value: "all" | K) => void;
}) {
  return (
    <NativeSelect
      aria-label={`${label} 필터`}
      className="w-auto"
      value={value}
      onChange={(e) => onChange(e.target.value as "all" | K)}
    >
      <option value="all">{label} 전체</option>
      {(Object.entries(labels) as [K, string][]).map(([key, optionLabel]) => (
        <option key={key} value={key}>
          {optionLabel}
        </option>
      ))}
    </NativeSelect>
  );
}
