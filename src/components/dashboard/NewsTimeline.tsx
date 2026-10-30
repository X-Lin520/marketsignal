"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NewsCard } from "./NewsCard";
import { NewsDetailSheet } from "./NewsDetailSheet";
import { Inbox } from "lucide-react";
import { useLanguage } from "@/providers/language-provider";
import type { NewsItemData } from "@/types";

export function NewsTimeline({
  items,
  total,
  hasFetched,
  busy,
  onLoadMore,
  onAnalyzed,
  onSingleBusyChange,
}: {
  items: NewsItemData[];
  total: number;
  hasFetched: boolean;
  busy: boolean;
  onLoadMore: () => void;
  onAnalyzed: (item: NewsItemData) => void;
  onSingleBusyChange: (busy: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
    });
    observer.observe(element);
    return () => observer.disconnect();
  // 不随条目数量重新订阅，避免停在页底时一次滚动连续加载所有批次。
  }, [onLoadMore, total]);
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  if (items.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox className="mb-3 h-10 w-10 text-terminal-text-muted" />
        <p className="text-sm font-medium">
          {hasFetched
            ? t.dashboard.timeline.noNews
            : language === "zh"
              ? "当前页面还没有新闻"
              : "No news in this page yet"}
        </p>
        <p className="mt-1 text-xs text-terminal-text-muted">
          {hasFetched
            ? t.dashboard.timeline.noNewsHint
            : language === "zh"
              ? "点击“抓取最新新闻”开始，刷新页面后会清空。"
              : "Fetch the latest news to start. Reloading clears this page."}
        </p>
      </div>
    );
  return (
    <>
      <div className="space-y-3">
        {items.map((item) => (
          <NewsCard
            key={item.id}
            item={item}
            onClick={setSelectedId}
            isSelected={item.id === selectedId}
          />
        ))}
        {items.length < total && (
          <div ref={sentinel} className="flex justify-center py-4">
            <Button variant="outline" size="sm" onClick={onLoadMore}>
              {t.dashboard.timeline.loadMore} ({total - items.length}{" "}
              {t.dashboard.timeline.remaining})
            </Button>
          </div>
        )}
      </div>
      <NewsDetailSheet
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedId(null)}
        onAnalyzed={onAnalyzed}
        analysisDisabled={busy}
        onAnalysisBusyChange={onSingleBusyChange}
      />
    </>
  );
}
