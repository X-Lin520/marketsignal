"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Newspaper, TrendingDown, TrendingUp, Minus, Clock, RefreshCw, Download } from "lucide-react";
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
  isFetching: boolean;
  onFetchNews: () => void;
  isResetting: boolean;
  onReanalyzeAll: () => void;
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
  isFetching,
  onFetchNews,
  isResetting,
  onReanalyzeAll,
}: DashboardHeaderProps) {
  const { t, language } = useLanguage();
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
    <div className="space-y-3">
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

        <div className="flex items-center gap-2 text-xs text-terminal-text-muted">
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

      {/* Fetch News button */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onFetchNews}
          disabled={isFetching || isResetting}
          className="h-7 flex-1 text-xs"
        >
          <Download className={`mr-1.5 h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching
            ? (language === "zh" ? "正在抓取..." : "Fetching...")
            : (language === "zh" ? "抓取最新新闻" : "Fetch News")
          }
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onReanalyzeAll}
          disabled={isResetting || isFetching}
          className="h-7 flex-1 text-xs"
        >
          <RefreshCw className={`mr-1.5 h-3 w-3 ${isResetting ? "animate-spin" : ""}`} />
          {isResetting
            ? (language === "zh" ? "正在重分析..." : "Re-analyzing...")
            : (language === "zh" ? "全部重新分析" : "Re-analyze All")
          }
        </Button>
      </div>
    </div>
  );
}
