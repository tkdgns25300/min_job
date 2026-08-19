"use client";

import { useId, type ReactNode } from "react";

// 폼 입력 한 칸(라벨 위 · 입력 아래) — 공고 등록·교회 인증·교회 정보·수집 도구가 같은 것을 4벌씩
// 따로 만들고 있었다(CLAUDE.md 배치 규칙: 두 곳 이상이면 페이지 폴더 밖으로). 라벨 크기가 화면마다
// 달랐고, 한 곳에 prop을 추가해도 나머지가 따라오지 않았다.
//
// 컨트롤이 하나면 <label>로 감싸 id 없이 이름이 붙고, 여럿이면 group으로 role="group"이 된다.
// 감싸기를 기본으로 두는 이유: 호출부 40곳이 아무것도 안 해도 접근성 이름을 얻는다.
export function Field({
  label,
  optional,
  required,
  hint,
  error,
  group,
  children,
}: {
  label: string;
  /** "선택" 표기 — 필수가 기본인 폼에서 표시하지 않으면 필수로 읽힌다 */
  optional?: boolean;
  required?: boolean;
  hint?: string;
  error?: string;
  /**
   * 자녀가 컨트롤 여럿일 때 켠다(사례비 min·max, 칩 셀렉트, 자체 `<label>`을 가진 파일 업로드).
   * 안 켜면 라벨이 **첫 컨트롤에만** 연결돼 틀린 이름을 주고, 자녀가 `<label>`이면 중첩이 되어
   * 잘못된 HTML이 된다. 켠 칸은 개별 컨트롤에 각자 `aria-label`을 달아야 한다.
   */
  group?: boolean;
  children: ReactNode;
}) {
  const labelId = useId();
  const body = (
    <>
      <p id={group ? labelId : undefined} className="mb-1.5 text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
        {optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">선택</span>}
      </p>
      {children}
      {hint && (
        <p className="mt-1.5 text-xs leading-relaxed break-keep text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </>
  );

  return group ? (
    <div role="group" aria-labelledby={labelId}>
      {body}
    </div>
  ) : (
    <label className="block">{body}</label>
  );
}
