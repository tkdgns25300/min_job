import { Placeholder } from "@/components/layout/placeholder";

export default function MyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">마이페이지</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Placeholder label="교회: 내가 등록한 공고 관리" className="min-h-40" />
        <Placeholder label="구직자: 북마크(스크랩한 공고) — Phase 2" className="min-h-40" />
      </div>
    </div>
  );
}
