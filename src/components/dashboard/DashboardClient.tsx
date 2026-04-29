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
      />

      <NewsFilter sources={sources} />

      <NewsTimeline initialData={initialData} />
    </div>
  );
}
