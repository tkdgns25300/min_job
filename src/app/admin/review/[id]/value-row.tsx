"use client";

import { ValueRow as GenericValueRow, type RowCheck } from "@/components/admin/value-row";
import { ROW_LABELS, type Checks, type RowKey } from "./value-rows";

// 검수용 값 줄 — 껍데기는 `components/admin/value-row`가 그리고, 여기서 **검수 고유의 두 가지**를
// 채워 넘긴다: 라벨을 `ROW_LABELS`에서 읽고, 확인 표시를 `Checks`에 연결한다.
//
// ⚠️ 이 얇은 층이 지키는 것: 줄이 `name`(=`RowKey`)으로만 만들어지므로 **`ROW_LABELS`에 없는 줄은
//    만들 수 없다**(타입 에러). 진행률의 분모가 그 목록 크기라, 라벨을 직접 넘기게 하면 그 연결이
//    끊긴다. 공고 관리 화면은 확인 표시가 없어 제네릭을 바로 쓴다.

/** 검수 줄이 공통으로 받는 것 — 줄마다 두 prop을 따로 적지 않기 위한 묶음 */
export interface RowShared {
  editable: boolean;
  checks: Checks;
}

export function ValueRow({
  name,
  label,
  checks,
  ...rest
}: Omit<Parameters<typeof GenericValueRow>[0], "label" | "check"> & {
  name: RowKey;
  /**
   * 라벨 덮어쓰기 — **값에 따라 이름이 바뀌는 칸에만** 쓴다(사역직은 "사례비", 일반직은 "급여" ·
   * `payLabel`이 정본 · DATA §3). ⚠️ 남용하면 `ROW_LABELS`가 라벨의 단일 소스라는 말이 거짓이 된다.
   */
  label?: string;
  checks: Checks;
}) {
  const check: RowCheck = {
    checked: checks.has(name),
    onToggle: () => checks.toggle(name),
  };
  return <GenericValueRow label={label ?? ROW_LABELS[name]} check={check} {...rest} />;
}

export { Empty, Lines, ValueSection } from "@/components/admin/value-row";
