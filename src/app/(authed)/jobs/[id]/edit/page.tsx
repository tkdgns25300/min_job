import { Placeholder } from "@/components/layout/placeholder";

// 스캐폴드: 정적 레이아웃만. 실제 수정 폼(인증·기존 값)은 Phase 1에서 구현.
export default function JobEditPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">공고 수정</h1>
      <Placeholder label="수정 폼 자리 (등록 폼과 동일 필드, 기존 값 채움)" className="min-h-96" />
    </div>
  );
}
