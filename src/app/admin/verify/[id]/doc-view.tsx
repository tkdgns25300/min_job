"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ChurchVerificationDetail } from "@/types/domain";

// 증빙 서류 보기 — 검수의 절반은 사실 이 서류를 읽는 일이다.
//
// **확대가 필요한 이유**: 고유번호증은 A4 한 장이라 열 폭에 맞추면 **10자리 번호가 읽히지 않는다.**
// 수집 검수가 같은 문제를 겪고 남긴 실측이 근거다(`admin/review/[id]/poster-view.tsx`):
// "새 탭으로 여는 것만으로는 값과 대조할 수 없다 — 그림과 값이 같은 화면에 있어야 검수가 된다."
//
// ⚠️ **`PosterView`를 재사용하지 않는다**(2026-08-26 판단). 같은 교훈을 쓰지만 필요가 다르다:
//    서류는 **한 장**이고(여러 장 넘기기 없음), 그쪽 문자열은 "포스터"로 박혀 있으며, 타입이
//    `lib/queries/review.ts`에 있어 인증 화면이 수집 검수 쿼리 모듈에 의존하게 된다.
//    두 번째 쓰임이라 그대로 둔다(CLAUDE.md "추상화는 3번째에") — **세 번째가 생기면**
//    `components/admin/`으로 올리고 타입을 떼어낸다.
// ⛔ **회전 버튼을 두지 않는다** — CSS `rotate`만으로는 컨테이너 크기가 따라오지 않아 잘린다.
//    누운 사진은 **새 탭**에서 브라우저 뷰어의 회전을 쓴다.

/** 배율 단계 — 1은 열 폭에 맞춤. 그 위는 가로 스크롤이 생긴다 */
const ZOOMS = [1, 2, 3] as const;
type Zoom = (typeof ZOOMS)[number];

type Doc = NonNullable<ChurchVerificationDetail["doc"]>;

export function DocView({ doc }: { doc: ChurchVerificationDetail["doc"] }) {
  const [zoom, setZoom] = useState<Zoom>(ZOOMS[0]);

  // 파기됨 — 반려 처리가 파일을 지운다(`/privacy` §3). 서명 실패와 뜻이 다르다
  if (doc === null) {
    return <Empty>반려 처리하며 파기했어요. 신청자가 다시 신청하면 새 서류가 올라옵니다.</Empty>;
  }
  if (doc.url === null) {
    return <Empty>지금 열 수 없어요. 페이지를 새로 불러 주세요.</Empty>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {/* 확대는 이미지에만 있다 — PDF는 브라우저 보기 도구가 자기 확대를 갖는다 */}
        {doc.kind === "image" && (
          <Button variant="outline" size="sm" onClick={() => setZoom(nextZoom(zoom))}>
            {zoom === 1 ? "확대" : `${zoom}배 — 다시 맞춤`}
          </Button>
        )}
        <a
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-primary underline underline-offset-2"
        >
          새 탭 ↗
        </a>
        <span className="text-xs text-muted-foreground">
          {doc.kind === "pdf" ? "PDF" : "이미지"} · 30분 뒤 링크가 만료돼요
        </span>
      </div>

      <div className="overflow-auto rounded-xl border bg-muted/30">
        <DocBody kind={doc.kind} url={doc.url} zoom={zoom} />
      </div>
    </div>
  );
}

/** `url`을 따로 받는다 — 위에서 `null`을 걸러도 객체 타입은 좁혀지지 않는다 */
function DocBody({ kind, url, zoom }: { kind: Doc["kind"]; url: string; zoom: Zoom }) {
  if (kind === "pdf") {
    // 브라우저 기본 PDF 보기 도구가 뜬다(자체 확대·페이지 이동을 갖는다)
    return <iframe src={url} title="증빙 서류" className="h-[78dvh] w-full" />;
  }
  return (
    // next/image를 쓰지 않는다 — 30분 만료 signed URL이라 최적화 캐시 키가 매번 달라져
    // 이득 없이 함수만 돈다. 크기도 모른다(폰으로 찍은 서류는 비율이 제각각).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="증빙 서류"
      className="block h-auto max-w-none"
      style={{ width: `${zoom * 100}%` }}
    />
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm leading-relaxed break-keep text-muted-foreground">
      {children}
    </p>
  );
}

function nextZoom(current: Zoom): Zoom {
  return ZOOMS[(ZOOMS.indexOf(current) + 1) % ZOOMS.length];
}
