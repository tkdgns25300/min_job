import type { ReactNode } from "react";
import { QUALIFICATIONS } from "@/constants/domain";
import { enumLabel } from "@/lib/format";
import type { Tables } from "@/types/database";

// 고칠 수 없고 **그대로 공개되는** 값 — 편집칸을 만들지 않은 이유는 `lib/review-edits.ts`에 적었다.
// 보여는 준다: 승인은 "이대로 나가도 되나"를 묻는 일이라 나갈 것을 다 봐야 답할 수 있다.

export function PassthroughValues({ row }: { row: Tables<"review_data"> }) {
  const lists: [string, string[]][] = [
    ["지원 요건", row.requirements],
    ["우대 사항", row.preferred],
    ["필수 서류", row.required_docs],
    ["선택 서류", row.optional_docs],
    ["전형 절차", row.process_steps],
  ];
  const texts: [string, string | null][] = [
    ["자격", enumLabel(QUALIFICATIONS, row.qualification)],
    ["모집 인원", row.headcount],
    ["시작 시기", row.start_timing],
    ["근무일", row.work_days],
    ["복리후생", row.benefit_note],
    ["주소", row.address],
  ];

  const filledTexts = texts.filter(([, value]) => value);
  const filledLists = lists.filter(([, items]) => items.length > 0);

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-bold">그대로 공개되는 값</h2>
      <p className="mt-1 text-xs break-keep text-muted-foreground">
        여기서는 고칠 수 없습니다. 목록 표시용이라 틀려도 사고가 나지 않고, 칸을 늘리면 한 건에 드는
        시간이 늘어 큐가 밀립니다 — 이 값이 잘못됐다면 사유를 적고 거절해 주세요.
      </p>

      <dl className="mt-3 space-y-2 text-xs">
        <ValueRow label="게시일" locked>
          {row.posted_at} — 중복 묶음의 최신 게시일로 덮이는 파생값입니다
        </ValueRow>
        {filledTexts.map(([label, value]) => (
          <ValueRow key={label} label={label}>
            {value}
          </ValueRow>
        ))}
        {filledLists.map(([label, items]) => (
          <ValueRow key={label} label={`${label} (${items.length})`}>
            <ul className="space-y-1">
              {/* 인덱스를 key로 쓴다 — AI 추출 배열엔 같은 문장이 두 번 들어올 수 있고, 순서는 고정이다 */}
              {items.map((item, index) => (
                <li key={index} className="break-keep">
                  · {item}
                </li>
              ))}
            </ul>
          </ValueRow>
        ))}
        {filledTexts.length === 0 && filledLists.length === 0 && (
          <p className="text-muted-foreground">그 외에 채워진 값이 없습니다.</p>
        )}
      </dl>
    </section>
  );
}

function ValueRow({
  label,
  locked,
  children,
}: {
  label: string;
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="sm:flex sm:gap-3">
      <dt className="font-semibold text-muted-foreground sm:w-24 sm:shrink-0">
        {label}
        {locked && <span className="ml-1 font-normal">고정</span>}
      </dt>
      <dd className="mt-0.5 min-w-0 flex-1 leading-relaxed break-keep sm:mt-0">{children}</dd>
    </div>
  );
}
