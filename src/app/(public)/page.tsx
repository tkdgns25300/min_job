import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <section className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          흩어진 부교역자 청빙 공고를 한곳에서
        </h1>
        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
          교단·지역·사례비·부서로 검색하고 비교하세요. 재공고 이력까지 한눈에.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/jobs" className={cn(buttonVariants({ size: "lg" }))}>
            공고 둘러보기
          </Link>
          <Link href="/about" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            서비스 소개
          </Link>
        </div>
      </section>
    </div>
  );
}
