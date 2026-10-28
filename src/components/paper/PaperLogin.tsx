"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function PaperLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/paper/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "登录失败");
      setPassword("");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "连接失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="paper-gate">
      <span className="paper-eyebrow">MARKETSIGNAL / PAPER LAB</span>
      <h1>
        让每一次判断
        <br />
        都有迹可循。
      </h1>
      <p>保存每日决策与证据，核对持仓和现金，用同一时间范围对照沪深 300。</p>
      <form className="paper-stack" onSubmit={login}>
        <label className="paper-field">
          实验区登录口令
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={1024}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="paper-error" role="alert">
            {error}
          </p>
        )}
        <button className="paper-button primary" disabled={busy}>
          {busy ? "正在登录…" : "进入实验区"}
        </button>
      </form>
      <Link href="/">返回新闻看板</Link>
    </section>
  );
}
