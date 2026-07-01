import { Camera, Globe, MessageCircle, MonitorPlay, Users, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHURCH_CHANNELS, type ChurchChannel } from "@/constants/domain";
import type { ChurchLink } from "@/types/domain";

// 브랜드 아이콘 대신 제네릭 매핑 (lucide 브랜드 아이콘 미제공)
const CHANNEL_ICON: Record<ChurchChannel, LucideIcon> = {
  HOMEPAGE: Globe,
  YOUTUBE: MonitorPlay,
  INSTAGRAM: Camera,
  FACEBOOK: Users,
  BAND: MessageCircle,
};

// enum 정의 순서대로 노출 (홈페이지·유튜브 우선)
const CHANNEL_ORDER = Object.keys(CHURCH_CHANNELS) as ChurchChannel[];

// 교회 채널 버튼 행 — 공고 상세 사이드바 / 교회 상세에서 공용. 없으면 렌더 X.
export function ChurchChannels({ links }: { links: ChurchLink[] }) {
  const urlByType = new Map(links.map((l) => [l.type, l.url]));
  const shown = CHANNEL_ORDER.filter((type) => urlByType.has(type));
  if (shown.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((type) => {
        const Icon = CHANNEL_ICON[type];
        return (
          <a
            key={type}
            href={urlByType.get(type)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Icon /> {CHURCH_CHANNELS[type]}
          </a>
        );
      })}
    </div>
  );
}
