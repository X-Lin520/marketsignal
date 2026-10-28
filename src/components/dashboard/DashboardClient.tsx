"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DashboardHeader } from "./DashboardHeader";
import { NewsTimeline } from "./NewsTimeline";
import type { NewsItemData, PaginatedResponse } from "@/types";

const NewsFilter = dynamic(
  () => import("./NewsFilter").then((m) => ({ default: m.NewsFilter })),
  { ssr: false },
);

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

interface DashboardStats {
  totalNews: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  lastIngestedAt: string | null;
}

interface DashboardClientProps {
  initialData: PaginatedResponse<NewsItemData>;
  stats: DashboardStats;
  sources: string[];
}

export function DashboardClient({
  initialData,
  stats: initialStats,
  sources,
}: DashboardClientProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [actionError, setActionError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const fresh = (await res.json()) as DashboardStats;
        setStats(fresh);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Auto-refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const fetchNews = useCallback(async () => {
    setIsFetching(true);
    setActionError("");
    try {
      const res = await fetch("/api/cron/ingest", {
        method: "POST",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "新闻抓取失败");
      window.location.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "抓取失败，请重试");
    } finally {
      setIsFetching(false);
    }
  }, []);

  const reanalyzeAll = useCallback(async () => {
    setIsResetting(true);
    setActionError("");
    try {
      const resetRes = await fetch("/api/reset-analysis", { method: "POST" });
      const reset = await resetRes.json();
      if (!resetRes.ok) throw new Error(reset.error ?? "重置失败");
      const ingestRes = await fetch("/api/cron/ingest", { method: "POST" });
      if (!ingestRes.ok)
        throw new Error("已重置，分析未完成，请稍后重新触发抓取");
      window.location.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "重新分析失败");
    } finally {
      setIsResetting(false);
    }
  }, []);

  // Auto-poll every 2 minutes
  useEffect(() => {
    pollRef.current = setInterval(refreshData, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshData]);

  // Refresh when user returns to tab
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshData();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [refreshData]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <DashboardHeader
        totalNews={stats.totalNews}
        bullishCount={stats.bullishCount}
        bearishCount={stats.bearishCount}
        neutralCount={stats.neutralCount}
        lastIngestedAt={stats.lastIngestedAt}
        lastRefresh={lastRefresh}
        isRefreshing={isRefreshing}
        onRefresh={refreshData}
        isFetching={isFetching}
        onFetchNews={fetchNews}
        isResetting={isResetting}
        onReanalyzeAll={reanalyzeAll}
      />

      {actionError && (
        <p role="alert" className="text-sm text-red-400">
          {actionError}{" "}
          <a className="underline" href="/paper">
            进入实验区登录
          </a>
        </p>
      )}

      <NewsFilter sources={sources} />

      <NewsTimeline initialData={initialData} />
    </div>
  );
}
