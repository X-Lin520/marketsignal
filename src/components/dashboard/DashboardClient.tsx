"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { DashboardHeader } from "./DashboardHeader";
import { NewsTimeline } from "./NewsTimeline";
import { useLanguage } from "@/providers/language-provider";
import {
  filterSession,
  sessionStats,
  toAnalysisInput,
} from "@/lib/session/view";
import type { NewsItemData } from "@/types";

const NewsFilter = dynamic(
  () => import("./NewsFilter").then((m) => ({ default: m.NewsFilter })),
  { ssr: false },
);

export function DashboardClient() {
  const [items, setItems] = useState<NewsItemData[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
  const [isFetching, setIsFetching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [singleBusy, setSingleBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "fetch" | "analyze" | null
  >(null);
  const [adminKey, setAdminKey] = useState("");
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [page, setPage] = useState({ query: "", limit: 10 });
  const lock = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const { language } = useLanguage();
  const zh = language === "zh";
  const query = useSearchParams().toString();
  const filtered = filterSession(items, new URLSearchParams(query));
  const limit = page.query === query ? page.limit : 10;
  const visible = filtered.slice(0, limit);
  const stats = sessionStats(items);
  const busy = isFetching || isAnalyzing || singleBusy;
  const loadMore = useCallback(
    () =>
      setPage((previous) => ({
        query,
        limit: (previous.query === query ? previous.limit : 10) + 10,
      })),
    [query],
  );

  useEffect(() => () => controller.current?.abort(), []);
  const reset = () => {
    controller.current?.abort();
    generation.current++;
    lock.current = false;
    setItems([]);
    setFetchedAt(null);
    setProcessedIds([]);
    setPage({ query, limit: 10 });
    setActionError(null);
    setNotice(null);
    setPendingAction(null);
    setAdminKey("");
    setLastRefresh(new Date());
  };
  const onAnalyzed = (updated: NewsItemData) => {
    setItems((previous) =>
      previous.map((item) => (item.id === updated.id ? updated : item)),
    );
    setProcessedIds((previous) => [...new Set([...previous, updated.id])]);
  };
  const performAction = async (secret: string, action: "fetch" | "analyze") => {
    if (lock.current || singleBusy) return;
    const batch = visible
      .filter((item) => !processedIds.includes(item.id))
      .slice(0, 10);
    if (action === "analyze" && batch.length === 0) {
      setNotice(
        zh
          ? "当前已加载新闻均已处理，请向下滚动加载下一批。"
          : "Scroll to load the next batch.",
      );
      return;
    }
    lock.current = true;
    const currentGeneration = generation.current;
    const requestController = new AbortController();
    controller.current = requestController;
    setIsFetching(action === "fetch");
    setIsAnalyzing(action === "analyze");
    setActionError(null);
    setNotice(null);
    try {
      const response = await fetch(
        action === "fetch" ? "/api/session/news" : "/api/session/analyze",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
          body:
            action === "analyze"
              ? JSON.stringify({ items: batch.map(toAnalysisInput) })
              : undefined,
          signal: requestController.signal,
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? zh
              ? "管理员密钥不正确，请检查 ADMIN_SECRET。"
              : "Incorrect administrator key."
            : result.error ||
                result.errors?.join("；") ||
                (zh ? "请求失败，请稍后重试。" : "Request failed."),
        );
      if (generation.current !== currentGeneration) return;
      if (action === "fetch") {
        setItems(result.items);
        setFetchedAt(result.fetchedAt);
        setProcessedIds([]);
        setPage({ query, limit: 10 });
        if (result.errors.length) setActionError(result.errors.join("；"));
        setNotice(
          zh
            ? `已加载最新 ${result.items.length} 条新闻，仅在当前页面保留。`
            : `Loaded ${result.items.length} latest articles for this page.`,
        );
      } else {
        const updates = new Map<string, NewsItemData>(
          result.items.map((item: NewsItemData) => [item.id, item]),
        );
        setItems((previous) =>
          previous.map((item) => updates.get(item.id) ?? item),
        );
        setProcessedIds((previous) => [
          ...new Set([...previous, ...batch.map((item) => item.id)]),
        ]);
        if (result.errors.length)
          setActionError(
            [
              ...new Set(
                result.errors.map((error: { error: string }) => error.error),
              ),
            ].join("；"),
          );
        setNotice(
          zh
            ? `本批完成：成功 ${result.succeeded} 条，失败 ${result.failed} 条。结果仅在当前页面保留。`
            : `Batch complete: ${result.succeeded} succeeded, ${result.failed} failed. Results stay in this page only.`,
        );
      }
      setLastRefresh(new Date());
    } catch (error) {
      if (
        !requestController.signal.aborted &&
        generation.current === currentGeneration
      )
        setActionError(error instanceof Error ? error.message : "请求失败");
    } finally {
      if (generation.current === currentGeneration) {
        lock.current = false;
        setIsFetching(false);
        setIsAnalyzing(false);
      }
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <DashboardHeader
        {...stats}
        lastIngestedAt={fetchedAt}
        lastRefresh={lastRefresh}
        isRefreshing={busy}
        onRefresh={reset}
        isFetching={isFetching}
        onFetchNews={() => {
          setNotice(null);
          setPendingAction("fetch");
        }}
        isResetting={isAnalyzing || singleBusy}
        onReanalyzeAll={() => {
          if (!items.length)
            setNotice(zh ? "请先抓取最新新闻。" : "Fetch news first.");
          else {
            setNotice(null);
            setPendingAction("analyze");
          }
        }}
      />
      <p role="status" className="text-sm text-muted-foreground">
        {zh
          ? "新闻和分析结果仅在当前页面保留，刷新后清空。抓取不调用 AI；滚动每次显示 10 条，点击分析才处理下一批。"
          : "News and analysis stay in this page only and clear on reload. Fetching and scrolling do not call AI; analyze up to 10 articles per click."}
      </p>
      {pendingAction && (
        <form
          className="space-y-2 rounded border border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const key = adminKey;
            const action = pendingAction;
            setAdminKey("");
            setPendingAction(null);
            void performAction(key, action);
          }}
        >
          <label htmlFor="admin-key" className="block text-sm">
            {zh
              ? "管理员密钥（ADMIN_SECRET）"
              : "Administrator key (ADMIN_SECRET)"}
          </label>
          <input
            id="admin-key"
            type="password"
            autoComplete="off"
            required
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            className="w-full rounded border border-border bg-background p-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {pendingAction === "analyze"
              ? zh
                ? "只分析已加载新闻中的下一批，最多 10 条，可能产生 API 费用。"
                : "Analyze up to 10 loaded articles. API charges may apply."
              : zh
                ? "重新抓取会替换本页新闻和分析结果，不会调用 AI。"
                : "Fetching replaces this page's news and analysis, without calling AI."}
          </p>
          <div className="flex gap-2">
            <button type="submit" className="rounded border px-3 py-1 text-sm">
              {zh ? "开始" : "Start"}
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm"
              onClick={() => {
                setAdminKey("");
                setPendingAction(null);
              }}
            >
              {zh ? "取消" : "Cancel"}
            </button>
          </div>
        </form>
      )}
      <NewsFilter
        sources={[...new Set(items.map((item) => item.source))].sort()}
      />
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <NewsTimeline
        items={visible}
        total={filtered.length}
        hasFetched={fetchedAt !== null}
        busy={isFetching || isAnalyzing}
        onLoadMore={loadMore}
        onAnalyzed={onAnalyzed}
        onSingleBusyChange={setSingleBusy}
      />
    </div>
  );
}
