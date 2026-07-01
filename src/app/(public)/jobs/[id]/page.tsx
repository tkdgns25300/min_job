import { Placeholder } from "@/components/layout/placeholder";

// 스캐폴드: 정적 레이아웃만. 실제 데이터는 Phase 1에서 params + 'use cache'로 구현.
export default function JobDetailPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Placeholder label="교회명 · 교단 · 지역 · 재공고 배지 영역" />
      <h1 className="text-2xl font-bold">공고 상세 (제목 자리)</h1>
      <Placeholder
        label="구조화 정보 (직분 · 부서 · 고용형태 · 사례비 · 출근요일 · 제출서류 · 자격요건)"
        className="min-h-48"
      />
      <Placeholder label="교회 정보 연결 (홈페이지 · 유튜브 링크)" />
      <Placeholder label="지원 안내 (교회 연락처 / 원문 보기)" />
    </div>
  );
}
