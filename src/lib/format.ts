// 도메인 값 표시 포매터

// 월 사례비 표시: 범위/단일/비정형(내규 등)/없음 순
export function formatStipend(min: number | null, max: number | null, note: string | null): string {
  if (min !== null && max !== null && min !== max) return `${min}~${max}만원`;
  if (min !== null) return `${min}만원`;
  if (note) return note;
  return "협의";
}
