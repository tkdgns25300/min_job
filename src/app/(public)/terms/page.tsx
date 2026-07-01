import { Placeholder } from "@/components/layout/placeholder";

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold">이용약관</h1>
      <Placeholder label="이용약관 본문 자리 (출시 전 법률 검토 필요)" className="min-h-64" />
    </div>
  );
}
