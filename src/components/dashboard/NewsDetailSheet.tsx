"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SENTIMENT_COLORS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils/helpers";
import { useLanguage } from "@/providers/language-provider";
import {
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Minus,
  Clock,
  Globe,
  Lightbulb,
  Layers,
  FileText,
} from "lucide-react";
import type { NewsItemData } from "@/types";

interface NewsDetailSheetProps {
  item: NewsItemData | null;
  isOpen: boolean;
  onClose: () => void;
}

const sentimentIcons = {
  Bullish: TrendingUp,
  Bearish: TrendingDown,
  Neutral: Minus,
};

const sentimentLabels: Record<string, { en: string; zh: string }> = {
  Bullish: { en: "Bullish · Favorable", zh: "利好 · 看涨" },
  Bearish: { en: "Bearish · Caution", zh: "利空 · 看跌" },
  Neutral: { en: "Neutral · Steady", zh: "中性 · 平稳" },
  Pending: { en: "Pending", zh: "分析中" },
};

export function NewsDetailSheet({
  item,
  isOpen,
  onClose,
}: NewsDetailSheetProps) {
  const { t, language } = useLanguage();

  if (!item) return null;

  const sentimentKey = item.sentiment ?? "Pending";
  const colors = SENTIMENT_COLORS[sentimentKey];
  const Icon = item.sentiment ? sentimentIcons[item.sentiment] : Minus;
  const hasAnalysis = item.analyzedAt !== null;
  const locale = language === "zh" ? "zh-CN" : "en-US";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] w-full gap-0 border-terminal-border bg-background p-0 shadow-2xl shadow-black/50 ring-1 ring-border sm:max-w-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-terminal-border px-6 py-4">
          <div className="min-w-0 flex-1">
            <DialogTitle className="line-clamp-2 text-sm font-semibold leading-snug">
              {item.title}
            </DialogTitle>
            <DialogDescription className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <Badge
                variant="outline"
                className="h-5 gap-1 px-1.5 text-[10px] font-normal"
              >
                <Globe className="h-3 w-3" />
                {item.source}
              </Badge>
              <span className="flex items-center gap-1 text-terminal-text-muted">
                <Clock className="h-3 w-3" />
                {new Date(item.publishedAt).toLocaleString(locale, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {t.dashboard.detail.original}{" "}
                <ExternalLink className="h-3 w-3" />
              </a>
            </DialogDescription>
          </div>
        </div>

        {/* Body */}
        <ScrollArea className="max-h-[calc(85vh-120px)]">
          <div className="space-y-4 px-6 py-5">
            {/* Sentiment Banner */}
            {item.sentiment ? (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3",
                  colors.bg,
                  colors.border.replace("border-l-", "border-"),
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    sentimentKey === "Bullish"
                      ? "bg-bullish/15"
                      : sentimentKey === "Bearish"
                        ? "bg-bearish/15"
                        : "bg-neutral-sentiment/15",
                  )}
                >
                  <Icon className={cn("h-5 w-5", colors.text)} />
                </div>
                <div>
                  <div className={cn("text-sm font-bold", colors.text)}>
                    {sentimentLabels[sentimentKey][language]}
                  </div>
                  <div className="text-xs text-terminal-text-muted">
                    {t.dashboard.detail.aiSentiment}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3">
                <p className="text-sm text-blue-400">
                  {t.dashboard.detail.analysisPending}
                </p>
              </div>
            )}

            {/* AI Summary Card */}
            {item.summary && (
              <Card className="border-terminal-border bg-muted/30 p-4 shadow-none">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-accent" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-terminal-text-muted">
                    {t.dashboard.detail.aiSummary}
                  </h4>
                </div>
                <p className="text-sm leading-relaxed">{item.summary}</p>
              </Card>
            )}

            {/* Impact Sectors Card */}
            <Card className="border-terminal-border bg-muted/30 p-4 shadow-none">
              <div className="mb-2 flex items-center gap-2">
                <Layers className="h-4 w-4 text-accent" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-terminal-text-muted">
                  {t.dashboard.detail.impactSectors}
                </h4>
              </div>
              {item.impactSectors.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {item.impactSectors.map((sector) => (
                    <Badge
                      key={sector}
                      className="px-2.5 py-1 text-xs font-medium"
                    >
                      {sector}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-terminal-text-muted">
                  {t.dashboard.detail.noSectors}
                </p>
              )}
            </Card>

            {/* Investment Insight Card */}
            <Card className="overflow-hidden border-terminal-border shadow-none">
              <div className="flex items-center gap-2 border-b border-terminal-border bg-muted/50 px-4 py-2.5">
                <Lightbulb className="h-4 w-4 text-amber-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-terminal-text-muted">
                  {t.dashboard.detail.investmentInsight}
                </h4>
              </div>
              <div className="p-4">
                {item.actionableAdvice ? (
                  <div className="rounded-md border-l-[3px] border-amber-500/60 bg-amber-500/5 px-4 py-3">
                    <p className="text-sm leading-relaxed">
                      {item.actionableAdvice}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-terminal-text-muted">
                    {t.dashboard.detail.noAdvice}
                  </p>
                )}
              </div>
            </Card>

            {/* Meta Footer */}
            <Separator className="bg-terminal-border" />
            <div className="flex items-center justify-between text-xs text-terminal-text-muted">
              {item.analyzedAt && (
                <span>
                  {t.dashboard.detail.analyzed}:{" "}
                  {new Date(item.analyzedAt).toLocaleString(locale, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
              <span className="italic text-terminal-text-muted/60">
                {t.dashboard.detail.disclaimer}
              </span>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
