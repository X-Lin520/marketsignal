import { cookies } from "next/headers";
import Link from "next/link";
import { authConfigured, isAuthenticated } from "@/lib/paper/auth";
import { SESSION_COOKIE } from "@/lib/paper/session";
import { paper } from "@/lib/paper";
import { PaperLogin } from "@/components/paper/PaperLogin";
import { PaperClient } from "@/components/paper/PaperClient";
import "./paper.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "模拟投资实验 · MarketSignal" };

export default async function PaperPage() {
  if (!authConfigured())
    return (
      <section className="paper-gate">
        <span className="paper-eyebrow">MARKETSIGNAL / PAPER LAB</span>
        <h1>模拟投资实验</h1>
        <p>实验区尚未启用。请管理员按仓库的模拟投资指南完成服务端访问配置。</p>
        <Link href="/">返回新闻看板</Link>
      </section>
    );
  const authenticated = isAuthenticated(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!authenticated) return <PaperLogin />;
  const initial = await paper.dashboard().catch(() => null);
  if (!initial) {
    return (
      <section className="paper-gate">
        <h1>实验数据暂不可用</h1>
        <p>请检查数据库连接和迁移是否完成。已有数据不会因刷新页面而被重置。</p>
        <a href="/paper">重新加载</a>
      </section>
    );
  }
  return (
    <PaperClient initial={initial} demo={process.env.PAPER_DEMO === "true"} />
  );
}
