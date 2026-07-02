import { Suspense } from "react";
import { getAdJobs, getAllJobCards } from "@/lib/queries/jobs";
import { JobsView } from "./jobs-view";

export default async function JobsPage() {
  const jobs = await getAllJobCards();
  const ads = await getAdJobs();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 border-b pb-6">
        <h1 className="text-xl font-bold">사역자 청빙</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          교회 청빙 공고를 한곳에서. 교단·지역·사례비로 검색하고 비교하세요.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}>
        <JobsView jobs={jobs} ads={ads} />
      </Suspense>
    </div>
  );
}
