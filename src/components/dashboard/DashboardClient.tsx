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
    try {
      const secret = process.env.NEXT_PUBLIC_CRON_SECRET || "dev-secret-change-in-production";
      const res = await fetch("/api/cron/ingest", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (res.ok) {
        const result = await res.json();
        console.log("Ingest result:", result);
        // Refresh stats after ingest
        await refreshData();
      }
    } catch (err) {
      console.error("Fetch news failed:", err);
    } finally {
      setIsFetching(false);
    }
  }, [refreshData]);

  const reanalyzeAll = useCallback(async () => {
    setIsResetting(true);
    try {
      const secret = process.env.NEXT_PUBLIC_CRON_SECRET || "dev-secret-change-in-production";
      const auth = { headers: { Authorization: `Bearer ${secret}` } };
      const resetRes = await fetch("/api/reset-analysis", { method: "POST", ...auth });
      if (resetRes.ok) {
        const { reset } = await resetRes.json();
        console.log(`Reset ${reset} items for re-analysis`);
      }
      await fetch("/api/cron/ingest", { method: "POST", ...auth });
      await refreshData();
    } catch (err) {
      console.error("Re-analyze failed:", err);
    } finally {
      setIsResetting(false);
    }
  }, [refreshData]);

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

      <NewsFilter sources={sources} />

      <NewsTimeline initialData={initialData} />
    </div>
  );
}
