"use client";

import { useState } from "react";
import { useLanguage } from "@/providers/language-provider";

export function AiSetup() {
  const { language } = useLanguage();
  const zh = language === "zh";
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function check(action: "status" | "test") {
    if (busy || !key) return;
    const secret = key;
    setKey("");
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/session/ai-status", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
        cache: "no-store",
      });
      const data = await res.json();
      setMessage(
        data.provider
          ? `${data.provider}: ${data.message}`
          : data.message || data.error || "请求失败",
      );
    } catch {
      setMessage(
        zh ? "连接失败，请稍后重试。" : "Connection failed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded border border-border p-3 text-sm">
      <summary className="cursor-pointer">
        {zh ? "AI 配置与连接检查" : "AI configuration and connection"}
      </summary>
      <p className="mt-2 text-muted-foreground">
        {zh
          ? "检查配置不会调用 AI。测试连接会发送一次简短请求，可能产生费用。每次操作需重新输入管理员密钥。"
          : "Checking configuration is free. Testing sends one request and may incur charges. Enter your administrator key for each action."}
      </p>
      <label htmlFor="setup-admin" className="mt-2 block">
        {zh ? "管理员密钥" : "Administrator key"}
      </label>
      <input
        id="setup-admin"
        type="password"
        autoComplete="off"
        value={key}
        onChange={(event) => setKey(event.target.value)}
        disabled={busy}
        className="mt-1 w-full rounded border bg-background p-2"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={busy || !key}
          onClick={() => void check("status")}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          {zh ? "检查配置" : "Check configuration"}
        </button>
        <button
          type="button"
          disabled={busy || !key}
          onClick={() => void check("test")}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          {zh ? "测试连接（可能收费）" : "Test connection (may incur charges)"}
        </button>
      </div>
      {message && (
        <p role="status" className="mt-2">
          {message}
        </p>
      )}
    </details>
  );
}
