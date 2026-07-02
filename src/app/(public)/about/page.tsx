import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "소개 | 민잡",
  description:
    "민잡은 흩어져 있는 부교역자 청빙 공고를 한 곳에 모아, 지역·교단·직분·부서로 찾아보고 비교할 수 있게 정리하는 서비스입니다.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 px-4 py-12">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold sm:text-3xl">소개</h1>
        <p className="leading-relaxed text-muted-foreground">
          민잡은 여러 곳에 흩어져 있는 부교역자(부목사·전도사) 청빙 공고를 한 곳에 모아,
          지역·교단·직분·부서 등으로 찾아보고 비교할 수 있게 정리하는 서비스입니다.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">왜 만들었나요</h2>
        <p className="leading-relaxed text-muted-foreground">
          청빙 공고는 신학교·교단 게시판 등 여러 곳에 나뉘어 있어 한눈에 보기 어렵습니다. 흩어진
          공고를 모아 같은 형식으로 정리해, 필요한 조건을 빠르게 찾도록 돕습니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">무엇을 할 수 있나요</h2>
        <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground marker:text-muted-foreground/40">
          <li>지역·교단·직분·부서·고용형태·교회 규모 등으로 검색하고 거릅니다.</li>
          <li>사례비·출근·자격요건 등 정리된 정보로 공고를 비교합니다.</li>
          <li>교회 홈페이지·유튜브 등 채널로 바로 이동해 확인합니다.</li>
          <li>같은 자리의 지난 공고 이력을 함께 봅니다.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">이런 분들께</h2>
        <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground marker:text-muted-foreground/40">
          <li>청빙 자리를 찾는 교역자</li>
          <li>함께 사역할 사람을 찾는 교회</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">문의</h2>
        <p className="leading-relaxed text-muted-foreground">
          서비스 관련 문의는{" "}
          <a
            href="mailto:contact@minjob.kr"
            className="font-medium text-foreground hover:underline"
          >
            contact@minjob.kr
          </a>
          로 보내 주세요.
        </p>
      </section>
    </div>
  );
}
