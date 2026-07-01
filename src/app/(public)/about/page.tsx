import { Placeholder } from "@/components/layout/placeholder";

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold">서비스 소개</h1>
      <Placeholder label="MinJob 소개 본문 자리 (문제·차별점·신뢰 메시지)" className="min-h-48" />
    </div>
  );
}
