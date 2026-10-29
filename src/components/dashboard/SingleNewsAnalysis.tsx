"use client";

import { useRef, useState } from "react";
import type { NewsItemData } from "@/types";
import { useLanguage } from "@/providers/language-provider";

export function SingleNewsAnalysis({
  newsId,
  onAnalyzed,
}: {
  newsId: string;
  onAnalyzed: (item: NewsItemData) => void;
}) {
  const { language } = useLanguage();
  const zh = language === "zh";
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const lock = useRef(false);

  return (
    <section className="space-y-3 rounded-lg border border-terminal-border p-4">
      <p className="text-sm text-muted-foreground">
        {zh
          ? "仅分析当前这一条新闻，可能产生 API 费用。"
          : "Analyze only this article. API charges may apply."}
      </p>
      {!open && (
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm"
          onClick={() => {
            setOpen(true);
            setDone(false);
            setError(null);
          }}
        >
          {zh ? "只分析这条" : "Analyze this article"}
        </button>
      )}
      {open && (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            setError(null);
            const key = secret;
            setSecret("");
            try {
              // 单次请求只发送一个新闻 ID，不启动批量处理或自动重试。
              const response = await fetch("/api/analyze", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${key}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ newsId }),
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(
                  response.status === 401
                    ? zh
                      ? "管理员密钥不正确，请检查 ADMIN_SECRET。"
                      : "Incorrect administrator key."
                    : result.error ||
                        (zh
                          ? "本条分析失败，请稍后重试。"
                          : "Analysis failed."),
                );
              if (!result.item || result.item.id !== newsId)
                throw new Error(
                  zh
                    ? "返回结果不完整，请刷新检查。"
                    : "Invalid response. Please refresh.",
                );
              onAnalyzed(result.item);
              setDone(true);
              setOpen(false);
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : zh
                    ? "请求失败，请检查网络。"
                    : "Request failed.",
              );
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          <label className="block text-sm" htmlFor={`single-key-${newsId}`}>
            {zh
              ? "管理员密钥（ADMIN_SECRET）"
              : "Administrator key (ADMIN_SECRET)"}
          </label>
          <input
            id={`single-key-${newsId}`}
            type="password"
            autoComplete="off"
            required
            disabled={busy}
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            className="w-full rounded border bg-background p-2"
          />
          <p className="text-xs text-muted-foreground">
            {zh
              ? "密钥仅用于本次请求，不保存到浏览器。"
              : "The key is used only for this request and is not stored."}
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
            >
              {busy
                ? zh
                  ? "正在分析这条…"
                  : "Analyzing…"
                : zh
                  ? "开始单条分析"
                  : "Start analysis"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
              onClick={() => {
                setSecret("");
                setOpen(false);
                setError(null);
              }}
            >
              {zh ? "取消" : "Cancel"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm text-green-500">
          {zh
            ? "这条新闻已分析并保存。"
            : "This article has been analyzed and saved."}
        </p>
      )}
    </section>
  );
}
