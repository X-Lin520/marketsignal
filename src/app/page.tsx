import { DashboardClient } from "@/components/dashboard/DashboardClient";

// 首页不读取历史记录，每次完整刷新都创建空的页面会话。
export default function HomePage() {
  return <DashboardClient />;
}
