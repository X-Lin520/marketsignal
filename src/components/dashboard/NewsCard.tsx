"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/helpers";
import { formatRelativeTime } from "@/lib/utils/helpers";
import { SENTIMENT_COLORS } from "@/lib/utils/constants";
import { useLanguage } from "@/providers/language-provider";
import type { NewsItemData } from "@/types";

interface NewsCardProps {
  item: NewsItemData;
  onClick: (id: string) => void;
  isSelected: boolean;
}

export function NewsCard({ item, onClick, isSelected }: NewsCardProps) {
  const { t } = useLanguage();
  const sentimentKey = item.sentiment ?? "Pending";
  const colors = SENTIMENT_COLORS[sentimentKey];
  const hasAnalysis = item.analyzedAt !== null;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${item.title} — ${sentimentKey}`}
      className={cn(
        "relative cursor-pointer border-l-4 bg-terminal-surface/40 p-4 transition-all hover:bg-terminal-surface/80 focus-visible:ring-2 focus-visible:ring-ring",
        colors.border,
        isSelected && "ring-2 ring-accent bg-terminal-surface",
      )}
      onClick={() => onClick(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(item.id);
        }
      }}
    >
      <div className="flex items-center gap-2 text-xs text-terminal-text-muted">
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
          {item.source}
        </Badge>
        <span className="tabular-nums">
          {formatRelativeTime(item.publishedAt)}
        </span>
        {!hasAnalysis && (
          <span className="ml-auto text-blue-400">
            {t.dashboard.timeline.processing}
          </span>
        )}
      </div>

      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
        {item.title}
      </h3>

      {item.summary && (
        <p className="mt-1 line-clamp-2 text-xs text-terminal-text-muted">
          {item.summary}
        </p>
      )}

      {item.impactSectors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.impactSectors.map((sector) => (
            <Badge
              key={sector}
              variant="secondary"
              className="h-5 px-1.5 text-[10px]"
            >
              {sector}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
