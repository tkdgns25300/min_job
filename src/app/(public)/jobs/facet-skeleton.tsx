// 랜딩 로딩 자리 — 셋이 같은 화면이라 스켈레톤도 공용이다.
// 이름 붙인 스켈레톤으로 두는 것이 이 프로젝트의 관용구다(레이아웃 시프트 방지 · `/jobs`와 같은 결).
export function FacetSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-5 h-28 animate-pulse rounded-2xl bg-muted" />
      <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2.5 px-4 py-4 sm:px-5">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
