import Link from "next/link";
import { Placeholder } from "@/components/layout/placeholder";

export default function AdminHomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">운영자 도구</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/ingest">
          <Placeholder label="수집 등록 도구 (/admin/ingest)" className="min-h-32" />
        </Link>
        <Link href="/admin/jobs">
          <Placeholder label="공고 관리 (/admin/jobs)" className="min-h-32" />
        </Link>
      </div>
    </div>
  );
}
