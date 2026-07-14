import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHURCH_CHANNELS, type ChurchChannel } from "@/constants/domain";
import type { ChurchLink } from "@/types/domain";

const CHANNEL_ORDER = Object.keys(CHURCH_CHANNELS) as ChurchChannel[];
const externalAttrs = { target: "_blank", rel: "noopener noreferrer" } as const;

// 브랜드 근사 마크(currentColor). 정식 로고 아님 — 색으로 인지. 필요 시 simple-icons로 교체.
const CHANNEL_ICON: Record<ChurchChannel, ReactNode> = {
  HOMEPAGE: (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  ),
  YOUTUBE: (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  ),
  INSTAGRAM: (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  FACEBOOK: (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 8h2.2V5H14c-2.3 0-3.6 1.5-3.6 3.7V10H8v3h2.4v7h3v-7h2.3l.4-3h-2.7V9c0-.7.3-1 1.2-1Z" />
    </svg>
  ),
  BAND: (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.4 4.6 3.6 6L5 21l4.2-2.1c.9.2 1.8.3 2.8.3 5.5 0 10-3.6 10-8.2S17.5 3 12 3Z" />
    </svg>
  ),
  ETC: (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 15l6-6" />
      <path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1" />
      <path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1" />
    </svg>
  ),
};

// 브랜드 색(틴트 배경 + 아이콘/텍스트 색). 홈페이지는 우리 그린.
const CHANNEL_BRAND: Record<ChurchChannel, string> = {
  HOMEPAGE: "bg-primary/10 text-primary",
  YOUTUBE: "bg-[#FF0000]/10 text-[#FF0000]",
  INSTAGRAM: "bg-[#C1275F]/10 text-[#C1275F]",
  FACEBOOK: "bg-[#1877F2]/10 text-[#1877F2]",
  BAND: "bg-[#03C75A]/12 text-[#04A94C]",
  ETC: "bg-muted text-muted-foreground",
};

// 교회 채널 — 없으면 렌더 X. variant: plain(텍스트 칩) / brand(브랜드 색·아이콘 틴트 버튼)
export function ChurchChannels({
  links,
  variant = "plain",
}: {
  links: ChurchLink[];
  variant?: "plain" | "brand";
}) {
  const urlByType = new Map(links.map((l) => [l.type, l.url]));
  const shown = CHANNEL_ORDER.filter((type) => urlByType.has(type));
  if (shown.length === 0) return null;

  if (variant === "plain") {
    return (
      <div className="flex flex-wrap gap-2">
        {shown.map((type) => (
          <a
            key={type}
            href={urlByType.get(type)}
            {...externalAttrs}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {CHURCH_CHANNELS[type]}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((type) => (
        <a
          key={type}
          href={urlByType.get(type)}
          {...externalAttrs}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80",
            CHANNEL_BRAND[type],
          )}
        >
          {CHANNEL_ICON[type]}
          {CHURCH_CHANNELS[type]}
        </a>
      ))}
    </div>
  );
}
