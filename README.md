# MarketSignal

财经新闻监控仪表盘：从 RSS 采集新闻，以 DeepSeek 分析摘要、情绪和受影响板块，并提供筛选与原文链接。AI 输出仅供参考，不构成投资建议。

## 现状和前提

- Next.js 16、React 19、Prisma 6 和 **PostgreSQL**；当前 schema 不支持 SQLite。
- AI 使用 DeepSeek `deepseek-flash`。为兼容现有部署，DeepSeek API key 仍存于服务端 `OPENAI_API_KEY` 变量。关闭或失败的分析保持待处理，不计作中性。
- `vercel.json` 当前配置为 **每天 UTC 00:00**，并非每 5 分钟。实际频率需结合 Vercel 套餐限制和 API 成本确定。
- 每次采集最多自动分析 10 条待处理新闻，剩余条目保留到后续任务；手动重分析仍需单独操作并可能产生额外费用。
- 仓库保留的旧迁移是 SQLite 格式，与当前 PostgreSQL schema 不一致。生产库应先备份，核对现有 schema 和迁移历史，制定并演练 PostgreSQL 基线迁移及回滚；不要直接对生产库执行 `db push` 或旧迁移。

## 本地运行

1. 准备 Node.js 20.9 或以上版本和独立的 PostgreSQL 测试数据库。
2. 安装依赖：`npm ci`。
3. 从 `.env.example` 复制到 `.env.local`，设置 `DATABASE_URL`、`DIRECT_URL`。如需 AI，设置 `OPENAI_API_KEY` 为 DeepSeek API key 并设置 `ENABLE_AI=true`；否则设置 `ENABLE_AI=false`。生成独立随机的 `CRON_SECRET` 和 `ADMIN_SECRET`，不要添加到代码或提交到 Git。
4. **仅对新的、可丢弃的本地测试库**：运行 `npx prisma db push`、`npx prisma generate`；可选运行 `npm run db:seed` 加入模拟新闻。示例内容和链接并非实时新闻。
5. 运行 `npm run dev`，打开 `http://localhost:3000`。

## 操作与保护

- 统计和新闻列表是只读接口。筛选更改时会刷新列表，失败会显示错误提示。
- Vercel Cron 对 `/api/cron/ingest` 发起 GET，并使用 `CRON_SECRET`；手动抓取使用 POST 和 `ADMIN_SECRET`。
- 手动抓取及重新分析在页面中输入管理员密钥，密钥仅保存在当前操作的内存中，不放入 `NEXT_PUBLIC_` 变量或浏览器持久存储。请只在可信设备和 HTTPS 环境使用。
- 全部重新分析按批执行。每条只有分析成功后才替换原结果，失败保留原结果；会产生模型调用费用，操作前应评估数量和预算。关闭页面或网络中断后，未处理部分不会自动继续。
- 旧的 `/api/reset-analysis` 已停用。上线前仍应配置独立的访问控制、请求频率限制和监控；共享密钥不是完整的多用户登录系统。
- 旧版本写入的占位“中性”结果不会自动修复。生产数据需先备份、识别占位记录，再决定是否重分析。

## 检查与部署

执行 `npx tsc --noEmit`、`npm run lint` 和 `npm run build`，并使用独立数据库验证采集、分析、筛选、错误处理和分页。部署前确认环境变量、数据库备份和恢复流程、管理员密钥以及定时任务是否符合套餐限制。部署后查看运行日志，并核对实际最新采集时间；构建成功不能证明数据链路正常。

生产构建脚本只生成 Prisma Client 并构建应用，不会自动修改数据库 schema。部署前仍须完成数据库迁移方案与验证。

发布前请确认上述配置、数据保护和验证步骤均已完成。
