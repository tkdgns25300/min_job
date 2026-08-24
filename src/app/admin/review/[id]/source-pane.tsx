import type { ReactNode } from "react";
import { boardLabel } from "@/constants/review";
import { formatKstDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReviewAttachment, ReviewDetail, SourceFormValue } from "@/lib/queries/review";
import { PosterView } from "./poster-view";

// 원문 열 — 검수는 "구조화된 값이 원문과 맞나"를 보는 일이므로 **원문이 왼쪽에 통째로** 있어야 한다.
// 서버 컴포넌트: 여기 있는 것은 전부 읽기 전용이고 요청마다 새로 만들어진다(포스터 URL은 30분 만료).

/**
 * 원문이 무슨 형태로 왔나 — **열 너비를 이 값이 정한다**(page.tsx).
 *
 * 열을 반반으로 고정하면 두 극단이 다 나쁘다: 포스터는 좁아서 확대해야 읽히고, 원문이 없는 건은
 * 빈 상자가 화면 절반을 먹는다. 실측 2026-08-23(PENDING 76건): **그림 82% · 텍스트 18% · 없음 0%**.
 * `none`은 지금 0건이지만 남겨 둔다 — 그림도 본문도 못 받는 일은 게시판이 바뀌면 다시 생긴다.
 */
export type SourceShape = "image" | "text" | "none";

export function sourceShape(detail: ReviewDetail): SourceShape {
  if (detail.posters.length > 0) return "image";
  // 게시판 양식 값도 **글로 온 원문**이다(CSU) — 본문만 보면 "받지 못함"으로 잘못 좁아진다
  return detail.source.raw_text.trim() || detail.source.form.length > 0 ? "text" : "none";
}

export function SourcePane({ detail }: { detail: ReviewDetail }) {
  const { row, source, posters, attachments } = detail;
  const shape = sourceShape(detail);
  // 게시판에 그림이 있었는데 올린 파일이 없다 = 바이트를 못 받았다(판정과 같은 규칙 · lib/review-flags)
  const lostImages = source.imageCount > 0 && row.poster_paths.length === 0;
  // 서명이 실패한 경우 — 경로는 있는데 URL이 없다. 원인은 로그에, 여기선 원문으로 안내한다.
  const unsignedPosters = row.poster_paths.length > 0 && posters.length === 0;
  const unreadCount = attachments.filter((file) => !file.readable).length;
  // 게시판 양식 값은 **본문과 같은 원문**이다(게시판이 폼으로 받은 것) — 한 덩어리로 그린다
  const hasBody = source.raw_text.trim() !== "" || source.form.length > 0;

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">{SHAPE_TITLE[shape]}</h2>
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
          boardLabel(source.source_key),
          // `posted_on`은 date 컬럼이라 그대로 쓴다 — 변환할 시간대가 없다(lib/format 주석)
          `게시 ${source.posted_on}`,
          `수집 ${formatKstDate(source.fetched_at)}`,
        ].join(" · ")}
      </p>

      {/* 게시판 글 제목 — 모델이 만들 수 없는 두 번째 출처다. 구조화된 제목과 다르면 그 차이가
          교회명·자리를 확인하는 재료가 된다(크롤러는 자동 대조를 오탐 때문에 뺐다 · SPEC §5.7) */}
      <p className="mt-2.5 text-sm leading-relaxed font-semibold break-keep">{source.title}</p>
      {row.title !== null && row.title.trim() !== source.title.trim() && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          구조화된 제목과 다릅니다 — 다듬은 결과일 수도, 다른 글에서 온 값일 수도 있습니다.
        </p>
      )}

      {lostImages && (
        <Notice tone="danger" title="그림을 못 받았습니다">
          게시판에 이미지 {source.imageCount}장이 있는데 파일을 받지 못했습니다. 값이 그림에만 있을
          수 있으니 원문을 열어 확인해 주세요.
        </Notice>
      )}
      {unsignedPosters && (
        <Notice tone="danger" title="포스터를 불러오지 못했습니다">
          파일 {row.poster_paths.length}개가 저장돼 있는데 열 수 없습니다. 원문 링크로 확인해
          주세요.
        </Notice>
      )}

      {posters.length > 0 && <PosterView posters={posters} />}

      <h3 className="mt-4 text-xs font-bold tracking-wide text-muted-foreground">본문</h3>
      {hasBody ? (
        <SourceBody form={source.form} text={source.raw_text} />
      ) : (
        <p className="mt-1.5 rounded-xl border border-dashed p-3 text-xs leading-relaxed break-keep text-muted-foreground">
          {shape === "image" ? (
            <>
              <b className="text-foreground">원문이 그림입니다</b> — 본문 텍스트가 없는 게
              정상입니다. 코드가 대조한 칸이 하나도 없으니{" "}
              <b className="text-foreground">값 전체를 포스터와 대조</b>해 주세요.
            </>
          ) : (
            <>
              <b className="text-destructive">대조할 원문이 화면에 없습니다</b> — 본문도 그림도 받지
              못했습니다. 값의 근거를 게시판에서 직접 확인하지 않았다면 승인하지 마세요.
            </>
          )}
        </p>
      )}

      {attachments.length > 0 && <Attachments files={attachments} unread={unreadCount} />}

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

const SHAPE_TITLE: Record<SourceShape, string> = {
  image: "원문 (그림)",
  text: "원문 (텍스트)",
  none: "원문 (받지 못함)",
};

/**
 * 원문 본문 — 게시판 글 그대로다(`source_data`. 우리가 다듬거나 자르지 않는다).
 *
 * **게시판 양식 값과 본문을 한 덩어리로** 그린다. 둘은 다른 것이 아니라 **같은 원문이 다른 모양으로
 * 온 것**이다: 대부분의 게시판은 자유 글(`raw_text`)로 받고, 총신대(CSU)처럼 폼으로 받는 게시판은
 * 같은 내용을 칸으로 받는다(`raw_meta`). 실측 2026-08-23: 양식 값이 있는 15건 중 **11건은 본문도
 * 함께** 있다 — 그래서 둘 중 하나를 고르는 게 아니라 순서대로 붙인다(게시판 화면도 양식이 위다).
 * 상자를 따로 두면 양식 값이 **메타 정보처럼** 보여 원문으로 읽히지 않는다.
 *
 * **`<pre>`로 그리지 않는다**(2026-08-23). 고정폭 글꼴에 원문의 빈 줄이 그대로 살아 코드처럼 보이고
 * 세로로 두 배 길어졌다 — 청빙 공고는 **읽어야 하는 글**이다. 빈 줄을 문단 경계로 삼아 문단 리듬을
 * 만들고, 문단 안의 줄바꿈은 `whitespace-pre-line`으로 살린다(항목 나열이 한 줄로 붙지 않게).
 *
 * ⚠️ 안쪽에 스크롤을 두지 않는다 — 왼쪽 열이 이미 `sticky` + 스크롤이라 스크롤이 두 겹이 되면
 *    바깥이 안 움직이는 구간이 생긴다. 긴 원문은 열 스크롤로 읽는다.
 * ⚠️ `raw_html`(구조를 남긴 본문)을 그리지 않는 이유: PENDING 76건 중 표·목록이 있는 것은 **3건**
 *    (4%)뿐이고 49건은 `raw_html`이 아예 비어 있다(실측 2026-08-23). 남의 게시판 HTML을
 *    `dangerouslySetInnerHTML`로 넣으려면 우리 손으로 소독해야 하는데, 그 위험을 4%와 바꾸지 않는다.
 *    표가 필요한 건은 **게시판 원문 열기**로 본다.
 */
function SourceBody({ form, text }: { form: SourceFormValue[]; text: string }) {
  // 빈 줄(공백만 있는 줄 포함)이 문단 경계다. 연속된 빈 줄은 하나로 본다.
  const paragraphs = text.trim() ? text.trim().split(/\n[ \t]*\n+/) : [];

  return (
    <div className="mt-1.5 rounded-xl border bg-muted/20 px-4 py-3.5">
      {form.length > 0 && (
        <dl className="space-y-1 text-sm">
          {form.map(({ label, value }) => (
            <div key={label} className="flex gap-3">
              <dt className="w-20 shrink-0 text-xs text-muted-foreground">{label}</dt>
              <dd className="min-w-0 flex-1 font-medium break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {form.length > 0 && paragraphs.length > 0 && <hr className="my-3.5 border-border/60" />}
      <div className="space-y-3">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className="text-sm leading-[1.75] break-words whitespace-pre-line break-keep"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * 첨부 — **이름을 보여주고 원문 링크로 보낸다. 여기서 열지 않는다.**
 *
 * 첨부 URL은 게시판 세션에 묶여 있어(그누보드 계열 4곳은 상세를 먼저 GET해야 파일이 온다 ·
 * 크롤러 SPEC §6) 우리 화면에서 링크를 걸면 `잘못된 접근입니다` HTML이 열린다. 이름과 개수만
 * 정직하게 보여주는 것이 검수에 필요한 전부다 — "이 값의 근거가 문서 안에 있을 수 있다".
 */
function Attachments({ files, unread }: { files: ReviewAttachment[]; unread: number }) {
  return (
    <div className="mt-4 rounded-xl border p-3">
      <h3 className="text-xs font-bold tracking-wide text-muted-foreground">
        첨부 {files.length}개
      </h3>
      <ul className="mt-1.5 space-y-1 text-xs">
        {files.map((file) => (
          <li key={file.name} className="flex items-baseline gap-2 break-all">
            <span className="min-w-0 flex-1">
              {file.name}
              {/* 게시판이 같은 파일을 여러 줄로 낸다 — 합쳐 놓지 않으면 목록이 이것만으로 찬다 */}
              {file.count > 1 && (
                <span className="ml-1 text-muted-foreground">같은 이름 {file.count}줄</span>
              )}
            </span>
            {!file.readable && (
              <span className="shrink-0 font-semibold text-muted-foreground">읽지 않음</span>
            )}
          </li>
        ))}
      </ul>
      {unread > 0 && (
        <p className="mt-2 text-xs leading-relaxed break-keep text-destructive">
          <b>{unread}개는 구조화가 열지 않았습니다</b> — 그림만 읽습니다. 본문이 “첨부파일 참조” 한
          줄이면 <b>값의 근거가 이 문서 안에만</b> 있습니다. 게시판에서 열어 확인해 주세요.
        </p>
      )}
    </div>
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
  return (
    <div
      className={cn(
        "mt-4 rounded-xl border p-3 text-xs leading-relaxed break-keep",
        tone === "danger"
          ? "border-destructive/25 bg-destructive/8 text-destructive"
          : "border-border bg-muted/30 text-muted-foreground",
      )}
    >
      <b className="mr-1 font-bold">{title}</b>
      {children}
    </div>
  );
}
