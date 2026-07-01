import { Placeholder } from "@/components/layout/placeholder";

export default function AdminJobsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">공고 관리</h1>
      <Placeholder label="전체 공고 목록 · 수정/삭제/상태 변경 영역" className="min-h-96" />
    </div>
  );
}
