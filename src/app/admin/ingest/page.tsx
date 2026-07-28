import type { Metadata } from "next";
import { getChurchOptions } from "@/lib/queries/churches";
import { IngestView } from "./ingest-view";

export const metadata: Metadata = { title: "공고 수집 | 민잡 운영자" };

// 공고 수집 — 사람이 확보한 원문 붙여넣기 → AI 구조화(mock) → 검토 후 '운영자 등록'.
// 교회 옵션은 인라인 매칭용('use cache', 공개 정보). ★ 자동 크롤러 아님(가드레일 #1).
export default async function AdminIngestPage() {
  const churchOptions = await getChurchOptions();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">공고 수집</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          사람이 확보한 공고 원문을 붙여넣으면 AI가 필드로 구조화해요. 검토·보정 후 ‘운영자
          등록’으로 게재됩니다.
        </p>
      </header>
      <IngestView churchOptions={churchOptions} />
    </div>
  );
}
