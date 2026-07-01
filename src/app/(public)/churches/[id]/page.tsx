import { Placeholder } from "@/components/layout/placeholder";

// 스캐폴드: 정적 레이아웃만. 실제 데이터는 Phase 1에서 params + 'use cache'로 구현.
export default function ChurchDetailPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Placeholder label="교회 기본 정보 (교회명 · 교단 · 지역 · 홈페이지 · 유튜브)" />
      <h1 className="text-2xl font-bold">교회 상세</h1>
      <Placeholder label="이 교회의 공고 목록 영역 (재공고 패턴 가시화)" className="min-h-64" />
    </div>
  );
}
