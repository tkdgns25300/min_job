import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MyJobRow } from "@/components/job/my-job-row";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/types/domain";
import type { MyJob } from "@/lib/queries/users";

// 계정 헤더 — 위계 낮게 한 줄 (이메일 + 역할 표시 + 로그아웃)
function AccountHeader({ user, isChurch }: { user: CurrentUser; isChurch: boolean }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">마이페이지</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {user.email} <span className="text-border">·</span> {isChurch ? "교회 계정" : "구직자"}
        </p>
      </div>
      {/* mock 단계 비활성 — Phase 1에서 Supabase signOut 배선 */}
      <Button variant="outline" size="sm" disabled>
        로그아웃
      </Button>
    </header>
  );
}

// [교회] 내가 등록한 공고 — 운영자 등록 공고(owner 없음)는 여기 뜨지 않는다 (가드레일 #2)
function ManagedJobsSection({ jobs }: { jobs: MyJob[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">내가 등록한 공고</h2>
        {jobs.length > 0 && (
          <Link href="/jobs/new" className={cn(buttonVariants({ size: "sm" }))}>
            <Plus /> 새 공고 등록
          </Link>
        )}
      </div>
      {jobs.length > 0 ? (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
          {jobs.map((job) => (
            <MyJobRow key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            아직 등록한 공고가 없어요. 첫 공고를 등록해 보세요 — 등록은 무료예요.
          </p>
          <Link href="/jobs/new" className={cn(buttonVariants({ size: "sm" }))}>
            공고 등록하기
          </Link>
        </div>
      )}
    </section>
  );
}

// [교회] 노출 안내 — pricing은 top nav가 아니라 교회 여정 맥락에서만 진입 (SPEC)
function PricingBanner() {
  return (
    <Link
      href="/pricing"
      className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3.5 text-sm shadow-sm transition-colors hover:border-ring"
    >
      <span className="text-muted-foreground">공고를 더 눈에 띄게 —</span>
      <span className="font-semibold">공고 노출 안내</span>
      <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground/60" />
    </Link>
  );
}

// [구직자] 저장한 공고 — 계정 귀속은 Phase 2. 지금 책갈피는 브라우저(localStorage)에만 저장.
function SavedJobsSection() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">저장한 공고</h2>
      <p className="rounded-2xl border border-dashed p-8 text-center text-sm leading-relaxed text-muted-foreground">
        계정에 저장한 공고 모아보기는 준비 중이에요. 지금 누른 책갈피는 이 브라우저에만 저장돼요.
        <Link href="/jobs" className="mt-1 block font-medium text-primary hover:underline">
          공고 보러 가기 →
        </Link>
      </p>
    </section>
  );
}

// TODO(design): ❓ 역할 모델 — 명시적 role 필드 없이 "등록 공고가 있으면 교회 섹션" 조건부(추천안)
// vs 가입 시 역할 선택 — 사람 결정 필요 (fable.md #8). 현재는 조건부.
export function MypageView({ user, myJobs }: { user: CurrentUser; myJobs: MyJob[] }) {
  const isChurch = myJobs.length > 0;

  return (
    <div className="space-y-8">
      <AccountHeader user={user} isChurch={isChurch} />
      <ManagedJobsSection jobs={myJobs} />
      {isChurch && <PricingBanner />}
      <SavedJobsSection />
    </div>
  );
}
