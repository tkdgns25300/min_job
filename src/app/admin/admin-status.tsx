import { requireOperator } from "@/lib/auth-guard";
import { todayInSeoul } from "@/lib/job-visibility";
import { getLastCrawlRun } from "@/lib/queries/crawl";
import { getAdminOverview } from "@/lib/queries/jobs";
import { getPendingSummary, getPublishBacklogCount } from "@/lib/queries/review";
import { getVerificationQueueSummary } from "@/lib/queries/verifications";
import { RefreshButton } from "./refresh-button";
import { CrawlCard, PublicCard, STATUS_SECTIONS, StatusSection, TaskCard } from "./status-cards";

// 운영자 홈의 본문 — 조회와 조합만 한다(그리는 일은 status-cards).
//
// **dynamic이다.** 다섯 조회 중 넷이 캐시할 수 없다: 검수·인증 큐는 판정하는 순간 바뀌고(캐시하면
// 방금 처리한 건이 남는다), 공개 대기도 같은 `review_data`이며, `crawl_run`은 크롤러가 우리 앱 밖에서 쓴다.
// 캐시되는 것은 `getAdminOverview`(공고 수치) 하나이고 그건 새로고침 버튼의 `updateTag("jobs")`가 비운다.
//
// 그 대가로 **페이지에서도 `requireOperator()`를 부를 수 있게 됐다** — `/admin`은 `○ Static`이던 동안
// proxy가 유일한 관문이었다(CLAUDE 2단 방어의 예외였다). 이제 예외가 하나 줄었다.

export async function AdminStatus() {
  await requireOperator();

  // 서로를 기다릴 이유가 없다 — 순서대로 await하면 왕복이 직렬로 쌓인다(검수 큐 화면과 같은 관용구).
  const [review, verification, crawl, overview, publishBacklog] = await Promise.all([
    getPendingSummary(),
    getVerificationQueueSummary(),
    getLastCrawlRun(),
    getAdminOverview(),
    getPublishBacklogCount(),
  ]);

  // dynamic 스코프라 "오늘"이 요청 시각 기준으로 정확하다(캐시 안에서 부르면 엔트리 수명만큼 굳는다)
  const today = todayInSeoul();

  return (
    <div className="space-y-6">
      <StatusSection title={STATUS_SECTIONS.tasks}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TaskCard
            label="수집 검수"
            href="/admin/review"
            summary={review}
            todayKst={today}
            oldestLabel="가장 오래된 건"
            emptyHint="검수 큐가 비어 있습니다"
          />
          <TaskCard
            label="교회 인증"
            href="/admin/verify"
            summary={verification}
            todayKst={today}
            oldestLabel="가장 오래된 신청"
            emptyHint="대기 중인 신청이 없습니다"
          />
        </div>
      </StatusSection>

      <StatusSection title={STATUS_SECTIONS.crawl}>
        <CrawlCard run={crawl} todayKst={today} />
      </StatusSection>

      <StatusSection title={STATUS_SECTIONS.publish}>
        <PublicCard
          overview={overview}
          publishBacklog={publishBacklog}
          action={<RefreshButton />}
        />
      </StatusSection>
    </div>
  );
}
