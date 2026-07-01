import { Placeholder } from "@/components/layout/placeholder";

export default function AdminIngestPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">수집 등록 도구</h1>
      <p className="text-sm text-muted-foreground">
        사람이 확보한 공고 텍스트 붙여넣기 → AI 구조화 → 검토 후 등록 (자동 크롤러 아님)
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Placeholder label="원문 텍스트 붙여넣기 영역" className="min-h-80" />
        <Placeholder label="AI 구조화 결과 · 검토 폼 영역" className="min-h-80" />
      </div>
    </div>
  );
}
