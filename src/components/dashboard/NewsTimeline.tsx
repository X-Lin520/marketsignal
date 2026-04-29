"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { NewsCard } from "./NewsCard";
import { NewsDetailSheet } from "./NewsDetailSheet";
import { SkeletonCard } from "./SkeletonCard";
import { useLanguage } from "@/providers/language-provider";
import type { NewsItemData, PaginatedResponse } from "@/types";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";

interface NewsTimelineProps {
  initialData: PaginatedResponse<NewsItemData>;
}

export function NewsTimeline({ initialData }: NewsTimelineProps) {
  const { t } = useLanguage();
  const [items, setItems] = useState<NewsItemData[]>(initialData.items);
  const [pagination, setPagination] = useState(initialData.pagination);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [currentUrl, setCurrentUrl] = useState("");
  useEffect(() => {
    const url = window.location.search;
    if (url !== currentUrl) {
      setCurrentUrl(url);
      setLoading(true);
      setError(null);
      fetch(`/api/news${url}${url ? "&" : "?"}page=1&limit=20`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((data: PaginatedResponse<NewsItemData>) => {
          setItems(data.items);
          setPagination(data.pagination);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [currentUrl]);

  const loadMore = useCallback(async () => {
    const nextPage = pagination.page + 1;
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("page", String(nextPage));
      params.set("limit", String(pagination.limit));
      const res = await fetch(`/api/news?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: PaginatedResponse<NewsItemData> = await res.json();
      setItems((prev) => [...prev, ...data.items]);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [pagination]);

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  if (loading && items.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
        <p className="text-sm font-medium">{t.dashboard.timeline.failedToLoad}</p>
        <p className="mt-1 text-xs text-terminal-text-muted">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          {t.dashboard.timeline.retry}
        </Button>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox className="mb-3 h-10 w-10 text-terminal-text-muted" />
        <p className="text-sm font-medium">{t.dashboard.timeline.noNews}</p>
        <p className="mt-1 text-xs text-terminal-text-muted">
          {t.dashboard.timeline.noNewsHint}
        </p>
      </div>
    );
  }

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

        {pagination.page < pagination.totalPages && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  {t.dashboard.timeline.loading}
                </>
              ) : (
                `${t.dashboard.timeline.loadMore} (${pagination.total - items.length} ${t.dashboard.timeline.remaining})`
              )}
            </Button>
          </div>
        )}
      </div>

      <NewsDetailSheet
        item={selectedItem}
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
