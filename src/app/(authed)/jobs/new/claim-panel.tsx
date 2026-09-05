"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { REGIONS } from "@/constants/domain";
import type { ClaimCandidate } from "@/lib/queries/users";
import { track } from "@/lib/analytics";
import { claimJob } from "../actions";

// 처음에 보여줄 후보 수 — 목록은 확실한 순이라 앞쪽이 답일 확률이 높다.
// 전부 펼쳐 두면 "해당 없음"(위저드로 가는 길)이 화면 밖으로 밀린다 — 실측 12건에서 패널 높이 1,086px.
const PREVIEW_COUNT = 5;

// 등록 전 클레임 패널 — **중복이 태어나는 지점**에서 막는다: 크롤로 이미 올라온 이 교회 공고가 있으면
// 위저드 대신 이 패널이 먼저 뜨고, 가져가면 수정 화면으로 간다(새로 만들 필요가 없어진다).
// 후보가 없거나 "해당 없음"을 누르면 children(위저드)을 그대로 그린다 — 그 경우 이 파일은 없는 것과 같다.
// 노출은 여기 한 곳뿐이다(대시보드 상시 노출은 안 한다 — 운영자 2026-09-01).
export function ClaimPanel({
  churchName,
  candidates,
  children,
}: {
  churchName: string;
  candidates: ClaimCandidate[];
  children: ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  // 실패는 **그 줄 아래**에 남긴다 — 패널 머리에 두면 목록이 길 때 어느 공고 이야기인지 알 수 없다
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  const [pending, startClaim] = useTransition();
  const router = useRouter();

  if (candidates.length === 0 || dismissed) return <>{children}</>;

  const shown = expanded ? candidates : candidates.slice(0, PREVIEW_COUNT);
  const restCount = candidates.length - shown.length;

  const claim = (id: string) =>
    startClaim(async () => {
      setClaimingId(id);
      setFailure(null);
      try {
        const result = await claimJob(id);
        if (result.message) setFailure({ id, message: result.message });
        else {
          // 가져왔으면 남은 일은 값 손보기 — 바로 수정 화면으로(토스트 후 이동, CLAUDE Styling)
          track({ name: "job_post", params: { via: "claim" } });
          toast.success("공고를 가져왔습니다.");
          router.push(`/jobs/${id}/edit`);
        }
      } catch (thrown) {
        unstable_rethrow(thrown); // 리다이렉트 등 Next 제어 신호는 삼키지 않는다
        console.error("[jobs] 클레임 실패", id, thrown);
        setFailure({ id, message: "공고를 가져오지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });

  return (
    <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6">
      <h2 className="text-lg font-bold break-keep">
        민잡에 이미 올라온 {churchName} 공고가 있어요
      </h2>
      <p className="mt-2 text-sm leading-relaxed break-keep text-muted-foreground">
        같은 자리라면 새로 등록하는 대신 가져와서 수정하세요 — 공고가 두 번 올라가지 않아요.
      </p>

      <ul className="mt-5 divide-y divide-border overflow-hidden rounded-xl border bg-card">
        {shown.map((c) => {
          // 공고가 말한 이름이 인증된 이름과 다르면 앞세운다 — 남의 교회 공고를 가려낼 유일한 단서다
          const otherName = c.churchName === churchName ? null : c.churchName;
          return (
            // 좁은 화면에서는 세로로 쌓는다 — 한 줄로 두면 글 칸이 버튼에 밀려 제목이 서너 줄로 쪼개진다
            <li
              key={c.id}
              className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4"
            >
              <div className="w-full min-w-0 sm:flex-1">
                <p className="font-semibold break-keep">{c.title}</p>
                {/* 조각 단위 줄바꿈 + 점은 뒤 조각에 붙인다 — 공고 카드 메타 줄과 같은 규칙 */}
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                  {otherName && (
                    <span className="max-w-full truncate font-semibold text-foreground">
                      {otherName}
                    </span>
                  )}
                  <span className="whitespace-nowrap">
                    {otherName && <span className="mr-1.5 text-border">·</span>}
                    {[c.region ? REGIONS[c.region] : null, c.city].filter(Boolean).join(" ") ||
                      "지역 미상"}
                  </span>
                  <span className="whitespace-nowrap">
                    <span className="mr-1.5 text-border">·</span>
                    {c.postedAt} 게시
                  </span>
                  {c.sourceUrl && (
                    <span className="whitespace-nowrap">
                      <span className="mr-1.5 text-border">·</span>
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        원문 보기 ↗
                      </a>
                    </span>
                  )}
                </p>
              </div>
              <ConfirmButton
                label={pending && claimingId === c.id ? "가져오는 중…" : "내 공고로 가져오기"}
                confirmLabel="가져와서 수정하기"
                confirmVariant="default"
                size="sm"
                disabled={pending}
                onConfirm={() => claim(c.id)}
              />
              {failure?.id === c.id && (
                <p role="alert" className="w-full text-sm font-semibold text-destructive">
                  {failure.message}
                </p>
              )}
            </li>
          );
        })}

        {restCount > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full p-3 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              후보 {restCount}개 더 보기
            </button>
          </li>
        )}
      </ul>

      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setDismissed(true)}>
          해당 없음 — 새로 등록하기
        </Button>
      </div>
    </section>
  );
}
