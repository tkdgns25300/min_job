import { Placeholder } from "@/components/layout/placeholder";

export default function JobNewPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">공고 등록</h1>
      <p className="text-sm text-muted-foreground">교회가 직접 올리는 공고 (등록 무료)</p>
      <Placeholder
        label="등록 폼 자리 (교단·지역·직분·부서·고용형태·사례비·출근요일·제출서류·홈페이지·유튜브)"
        className="min-h-96"
      />
    </div>
  );
}
