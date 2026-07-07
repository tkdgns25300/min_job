import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHURCH_CHANNELS, type ChurchChannel } from "@/constants/domain";
import type { ChurchLink } from "@/types/domain";

// enum 정의 순서대로 노출 (홈페이지·유튜브 우선)
const CHANNEL_ORDER = Object.keys(CHURCH_CHANNELS) as ChurchChannel[];

// 교회 채널 — 텍스트 칩(아이콘 없음). 공고 상세·교회 상세 공용. 없으면 렌더 X.
export function ChurchChannels({ links }: { links: ChurchLink[] }) {
  const urlByType = new Map(links.map((l) => [l.type, l.url]));
  const shown = CHANNEL_ORDER.filter((type) => urlByType.has(type));
  if (shown.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((type) => (
        <a
          key={type}
          href={urlByType.get(type)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {CHURCH_CHANNELS[type]}
        </a>
      ))}
    </div>
  );
}
