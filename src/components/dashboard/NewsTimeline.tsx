"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NewsCard } from "./NewsCard";
import { NewsDetailSheet } from "./NewsDetailSheet";
import { SkeletonCard } from "./SkeletonCard";
import { useLanguage } from "@/providers/language-provider";
import type { NewsItemData, PaginatedResponse } from "@/types";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface NewsTimelineProps {
  initialData: PaginatedResponse<NewsItemData>;
  refreshVersion: number;
  onItemsChange: (items: NewsItemData[]) => void;
  onAnalysisComplete?: () => void;
}

export function NewsTimeline({
  initialData,
  refreshVersion,
  onItemsChange,
  onAnalysisComplete,
}: NewsTimelineProps) {
  const { t } = useLanguage();
  const [items, setItems] = useState<NewsItemData[]>(
    initialData.items.slice(0, 10),
  );
  const [pagination, setPagination] = useState({
    ...initialData.pagination,
    page: 1,
    limit: 10,
    totalPages: Math.ceil(initialData.pagination.total / 10),
  });
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const loadedPages = useRef(1);
  const previousQuery = useRef("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const query = searchParams.toString();
  useEffect(() => {
    onItemsChange(items);
  }, [items, onItemsChange]);
  useEffect(() => {
    if (previousQuery.current !== query) loadedPages.current = 1;
    previousQuery.current = query;
    generation.current++;
    busy.current = true;
    const controller = new AbortController();
    const params = new URLSearchParams(query);
    params.set("page", "1");
    params.set("limit", "10");
    Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      Promise.all(
        Array.from({ length: loadedPages.current }, async (_, index) => {
          const pageParams = new URLSearchParams(params);
          pageParams.set("page", String(index + 1));
          const res = await fetch(`/api/news?${pageParams.toString()}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json() as Promise<PaginatedResponse<NewsItemData>>;
        }),
      )
        .then((pages) => {
          setItems([
            ...new Map(
              pages
                .flatMap((page) => page.items)
                .map((item) => [item.id, item]),
            ).values(),
          ]);
          setPagination(pages[pages.length - 1].pagination);
        })
        .catch((err) => {
          if (!controller.signal.aborted) setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
            busy.current = false;
          }
        });
    });
    return () => controller.abort();
  }, [query, refreshVersion]);

  const loadMore = useCallback(async () => {
    if (busy.current || pagination.page >= pagination.totalPages) return;
    busy.current = true;
    const version = generation.current;
    const nextPage = pagination.page + 1;
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("page", String(nextPage));
      params.set("limit", String(pagination.limit));
      const res = await fetch(`/api/news?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: PaginatedResponse<NewsItemData> = await res.json();
      if (generation.current !== version) return;
      loadedPages.current = nextPage;
      setItems((prev) => [
        ...new Map(
          [...prev, ...data.items].map((item) => [item.id, item]),
        ).values(),
      ]);
      setPagination(data.pagination);
    } catch (err) {
      if (generation.current === version)
        setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      if (generation.current === version) {
        setLoading(false);
        busy.current = false;
      }
    }
  }, [pagination]);

  useEffect(() => {
    const element = sentinel.current;
    if (
      !element ||
      loading ||
      error ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loadMore, loading, error]);

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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
        <p className="text-sm font-medium">
          {t.dashboard.timeline.failedToLoad}
        </p>
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
          <div ref={sentinel} className="flex justify-center py-4">
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
        onAnalyzed={(updated) => {
          setItems((previous) =>
            previous.map((item) => (item.id === updated.id ? updated : item)),
          );
          onAnalysisComplete?.();
        }}
      />
    </>
  );
}
