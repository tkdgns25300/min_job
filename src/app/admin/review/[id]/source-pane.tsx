import type { ReactNode } from "react";
import { formatKstDate } from "@/lib/format";
import type { ReviewDetail } from "@/lib/queries/review";

// 원문 열 — 검수는 "구조화된 값이 원문과 맞나"를 보는 일이므로 **원문이 왼쪽에 통째로** 있어야 한다.
// 서버 컴포넌트: 여기 있는 것은 전부 읽기 전용이고 요청마다 새로 만들어진다(포스터 URL은 30분 만료).

export function SourcePane({ detail }: { detail: ReviewDetail }) {
  const { row, source, posters } = detail;
  // 게시판에 그림이 있었는데 올린 파일이 없다 = 바이트를 못 받았다(배지와 같은 판정 · lib/review-flags)
  const lostImages = source.image_urls.length > 0 && row.poster_paths.length === 0;
  // 서명이 실패한 경우 — 경로는 있는데 URL이 없다. 원인은 로그에, 여기선 원문으로 안내한다.
  const unsignedPosters = row.poster_paths.length > 0 && posters.length === 0;
  const attachmentCount = Array.isArray(source.attachments) ? source.attachments.length : 0;

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">원문</h2>
        <a
          href={row.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-primary underline underline-offset-2"
        >
          게시판 원문 열기 ↗
        </a>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {[
          source.source_key,
          // `posted_on`은 date 컬럼이라 그대로 쓴다 — 변환할 시간대가 없다(lib/format 주석)
          `게시 ${source.posted_on}`,
          `수집 ${formatKstDate(source.fetched_at)}`,
          attachmentCount > 0 && `첨부 ${attachmentCount}개 — 원문에서 확인`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {lostImages && (
        <Notice tone="danger" title="그림을 못 받았습니다">
          게시판에 이미지 {source.image_urls.length}장이 있는데 파일을 받지 못했습니다. 값이
          그림에만 있을 수 있으니 원문을 열어 확인해 주세요.
        </Notice>
      )}
      {unsignedPosters && (
        <Notice tone="danger" title="포스터를 불러오지 못했습니다">
          파일 {row.poster_paths.length}개가 저장돼 있는데 열 수 없습니다. 원문 링크로 확인해
          주세요.
        </Notice>
      )}

      {posters.length > 0 && (
        <ul className="mt-4 space-y-3">
          {posters.map((poster, index) => (
            <li key={`${poster.path}-${index}`} className="overflow-hidden rounded-xl border">
              <a href={poster.url} target="_blank" rel="noreferrer">
                {/* next/image를 쓰지 않는다 — 30분 만료 signed URL이라 최적화 캐시 키가 매번 달라져
                    이득 없이 함수만 돈다. 크기도 모른다(게시판 포스터는 비율이 제각각). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={poster.url} alt={`포스터 ${index + 1}`} className="w-full" />
              </a>
              <p className="border-t bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                포스터 {index + 1} / {posters.length} ·{" "}
                <a
                  href={poster.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  원본 크기로 열기 ↗
                </a>{" "}
                — 연락처·사례비는 확대해야 읽힙니다
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-4 text-xs font-bold tracking-wide text-muted-foreground">본문</h3>
      {source.raw_text.trim() ? (
        <pre className="mt-1.5 max-h-96 overflow-auto rounded-xl border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
          {source.raw_text}
        </pre>
      ) : (
        <p className="mt-1.5 rounded-xl border border-dashed p-3 text-xs leading-relaxed break-keep text-muted-foreground">
          <b className="text-foreground">원문이 그림입니다</b> — 본문 텍스트가 없는 게 정상입니다.
          코드가 대조한 칸이 하나도 없으니{" "}
          <b className="text-foreground">값 전체를 포스터와 대조</b>해 주세요.
        </p>
      )}

      {row.heresy_flag && (
        <Notice tone="danger" title="이단 목록에 걸렸습니다">
          {row.heresy_evidence ?? "근거가 기록되지 않았습니다."}
        </Notice>
      )}
      {row.denomination_evidence && (
        <Notice tone="muted" title="교단 판정 근거">
          {row.denomination_evidence}
        </Notice>
      )}
    </section>
  );
}

/** 원문 쪽 안내 상자 — 네 곳의 모양이 같아야 한다(그림 못 받음·서명 실패·이단·교단 근거) */
function Notice({
  tone,
  title,
  children,
}: {
  tone: "danger" | "muted";
  title: string;
  children: ReactNode;
}) {
  const skin =
    tone === "danger"
      ? "border-destructive/25 bg-destructive/8 text-destructive"
      : "border-border bg-muted/30 text-muted-foreground";
  return (
    <div className={`mt-4 rounded-xl border p-3 text-xs leading-relaxed break-keep ${skin}`}>
      <b className="mr-1 font-bold">{title}</b>
      {children}
    </div>
  );
}
