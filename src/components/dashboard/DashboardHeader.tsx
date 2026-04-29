"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Newspaper, TrendingDown, TrendingUp, Minus, Clock, RefreshCw } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/helpers";
import { useLanguage } from "@/providers/language-provider";

interface DashboardHeaderProps {
  totalNews: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  lastIngestedAt: string | null;
  lastRefresh: Date;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function useElapsed(lastRefresh: Date) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [lastRefresh]);
  return elapsed;
}

export function DashboardHeader({
  totalNews,
  bullishCount,
  bearishCount,
  neutralCount,
  lastIngestedAt,
  lastRefresh,
  isRefreshing,
  onRefresh,
}: DashboardHeaderProps) {
  const { t } = useLanguage();
  const elapsed = useElapsed(lastRefresh);
  const secondsSinceRefresh = elapsed % 60;
  const minutesSinceRefresh = Math.floor(elapsed / 60);

  const stats = [
    { label: t.dashboard.stats.total, value: totalNews, icon: Newspaper, color: "text-foreground" },
    { label: t.dashboard.stats.bullish, value: bullishCount, icon: TrendingUp, color: "text-bullish" },
    { label: t.dashboard.stats.bearish, value: bearishCount, icon: TrendingDown, color: "text-bearish" },
    { label: t.dashboard.stats.neutral, value: neutralCount, icon: Minus, color: "text-neutral-sentiment" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-6">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${color}`} />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-terminal-text-muted">
                {label}
              </div>
              <div className="text-lg font-semibold tabular-nums leading-tight">
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-terminal-text-muted">
        {lastIngestedAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t.dashboard.stats.updated} {formatRelativeTime(lastIngestedAt)}
          </span>
        )}
        <span className="tabular-nums text-terminal-text-muted/60">
          {String(minutesSinceRefresh).padStart(2, "0")}:{String(secondsSinceRefresh).padStart(2, "0")}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-6 w-6"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
