"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DashboardHeader } from "./DashboardHeader";
import { NewsTimeline } from "./NewsTimeline";
import type { NewsItemData, PaginatedResponse } from "@/types";
import { useLanguage } from "@/providers/language-provider";

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
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"fetch" | "reanalyze" | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const { language } = useLanguage();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error(`统计数据刷新失败 (${res.status})`);
      const fresh = (await res.json()) as DashboardStats;
      setStats(fresh);
      setRefreshVersion((value) => value + 1);
      setActionError(null);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Auto-refresh failed:", err);
      setActionError(err instanceof Error ? err.message : "刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const fetchNews = useCallback(async (secret: string) => {
    setIsFetching(true);
    setActionError(null);
    try {
      const res = await fetch("/api/cron/ingest", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!res.ok) throw new Error(`抓取失败 (${res.status})，请检查管理员权限与服务配置。`);
      if (res.ok) {
        const result = await res.json();
        if (result.errors?.length) setActionError(`部分任务未完成：${result.errors.join("；")}`);
        console.log("Ingest result:", result);
        // Refresh stats after ingest
        await refreshData();
        if (result.errors?.length) setActionError(`部分任务未完成：${result.errors.join("；")}`);
      }
    } catch (err) {
      console.error("Fetch news failed:", err);
      setActionError(err instanceof Error ? err.message : "抓取失败");
    } finally {
      setIsFetching(false);
    }
  }, [refreshData]);

  const reanalyzeAll = useCallback(async (secret: string) => {
    setIsResetting(true);
    setActionError(null);
    try {
      let cursor: string | null = null;
      let succeeded = 0;
      let failed = 0;
      do {
        const res: Response = await fetch("/api/reanalyze", {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });
        if (!res.ok) throw new Error(`重分析中断 (${res.status})，已处理 ${succeeded} 条；其余结果保持不变。`);
        const batch: { succeeded: number; failed: number; nextCursor: string | null } = await res.json();
        succeeded += batch.succeeded;
        failed += batch.failed;
        cursor = batch.nextCursor;
      } while (cursor);
      await refreshData();
      setActionNotice(`重新分析完成：成功 ${succeeded} 条，失败 ${failed} 条；失败条目保留原结果。`);
    } catch (err) {
      console.error("Re-analyze failed:", err);
      setActionError(err instanceof Error ? err.message : "重分析失败");
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
        onFetchNews={() => { setActionNotice(null); setPendingAction("fetch"); }}
        isResetting={isResetting}
        onReanalyzeAll={() => { setActionNotice(null); setPendingAction("reanalyze"); }}
      />

      {pendingAction && (
        <form className="space-y-2 rounded border border-border p-3" onSubmit={(event) => {
          event.preventDefault();
          const secret = adminKey;
          const action = pendingAction;
          setAdminKey("");
          setPendingAction(null);
          if (action === "fetch") void fetchNews(secret);
          else void reanalyzeAll(secret);
        }}>
          <label htmlFor="admin-key" className="block text-sm">{language === "zh" ? "管理员密钥" : "Administrator key"}</label>
          <input id="admin-key" type="password" autoComplete="off" required value={adminKey} onChange={(event) => setAdminKey(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" />
          <p className="text-xs text-muted-foreground">{pendingAction === "reanalyze" ? (language === "zh" ? "将逐条重新分析，可能产生 API 费用；失败时保留原结果。" : "Each item will be re-analyzed and may incur API charges; failed items retain their previous result.") : (language === "zh" ? "密钥仅用于本次请求，不会保存在浏览器中。" : "The key is used for this request and is not stored in your browser.")}</p>
          <div className="flex gap-2"><button type="submit" className="rounded border border-border px-3 py-1 text-sm">{language === "zh" ? "开始" : "Start"}</button><button type="button" onClick={() => { setAdminKey(""); setPendingAction(null); }} className="rounded border border-border px-3 py-1 text-sm">{language === "zh" ? "取消" : "Cancel"}</button></div>
        </form>
      )}
      <NewsFilter sources={sources} />

      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      {actionNotice && <p role="status" className="text-sm">{actionNotice}</p>}
      <NewsTimeline initialData={initialData} refreshVersion={refreshVersion} />
    </div>
  );
}
