import Link from "next/link";

// 우측 레일 — 교회(공고 공급자) 유치 CTA. 등록 무료 강조, 딥그린 면.
export function ChurchCtaCard() {
  return (
    <div className="rounded-xl bg-primary p-4 text-primary-foreground">
      <p className="text-sm font-bold">교회 사역자를 찾으세요?</p>
      <p className="mt-1 text-xs leading-relaxed text-primary-foreground/80">
        공고 등록은 무료입니다. 지금 바로 올려보세요.
      </p>
      <Link
        href="/jobs/new"
        className="mt-3 block w-full rounded-md bg-white px-3 py-2 text-center text-sm font-semibold text-primary transition-colors hover:bg-white/90"
      >
        공고 등록하기
      </Link>
    </div>
  );
}
