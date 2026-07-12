import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "교회 인증 | 민잡" };

// 스캐폴드 — 교회 선택/생성 + 증빙 서류(고유번호증/사업자등록증) 업로드 폼은 다음 단계.
// 설계: SPEC "마이페이지 /mypage + 교회 인증" 블록. 실 업로드·승인은 Phase 1.
export default function ChurchVerifyPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 text-center sm:py-24">
      <h1 className="text-2xl font-bold">교회 인증</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        교회를 선택하고 고유번호증(또는 사업자등록증)을 올리면 운영자 확인 후 공고를 등록할 수 있어요.
        인증 신청 폼은 준비 중입니다.
      </p>
      <Link href="/mypage" className="mt-6 inline-block text-sm text-primary hover:underline">
        ← 마이페이지로 돌아가기
      </Link>
    </div>
  );
}
