import Link from "next/link";
import { Placeholder } from "@/components/layout/placeholder";

// 로그인은 공개/인증 셸과 분리된 독립 페이지 (루트 레이아웃 위 중앙 정렬)
export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Link href="/" className="text-xl font-bold tracking-tight">
          MinJob
        </Link>
        <h1 className="text-lg font-semibold">로그인</h1>
        <Placeholder label="카카오 간편 로그인 / 이메일 로그인 자리" className="min-h-40" />
      </div>
    </div>
  );
}
