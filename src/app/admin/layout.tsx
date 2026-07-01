import Link from "next/link";

// 운영자 전용 최소 셸 (공개 헤더/푸터 없음). 인증 게이트는 Phase 1.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
          <Link href="/admin" className="text-sm font-semibold">
            MinJob 운영자
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
