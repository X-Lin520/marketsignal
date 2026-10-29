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
- 每次点击重新分析，只处理已加载新闻中本次浏览会话尚未处理的下一批，最多 10 条，完成后停止。向下滚动每次加载 10 条新闻，加载不调用 AI；再次点击才分析下一批。失败条目保留原结果，整批处理过的条目不在本次会话自动重复；刷新页面后会话进度重置。
- `POST /api/reanalyze` 必须提交 1–10 个不同的 `newsIds`，只处理这些记录；旧版仅带 cursor 的请求会被拒绝，避免旧页面继续遍历全库。分析仍会产生 API 费用。
- 旧的 `/api/reset-analysis` 已停用。上线前仍应配置独立的访问控制、请求频率限制和监控；共享密钥不是完整的多用户登录系统。
- 旧版本写入的占位“中性”结果不会自动修复。生产数据需先备份、识别占位记录，再决定是否重分析。

## AI 失败排查

在 Vercel Runtime Logs 中搜索 `[AI] Analysis diagnostic`。单条、采集和重分析分别标记 `operation=analyze/ingest/reanalyze`；用 `newsId` 关联同一新闻的模型输出与保存步骤。

| code                    | 含义与核验字段                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `OUTPUT_TRUNCATED`      | 生成达到 Token 上限；核对 `finishReason=length`、`completionTokens`、`reasoningTokens` |
| `OUTPUT_EMPTY`          | 模型返回空正文                                                                         |
| `OUTPUT_INVALID_JSON`   | 经过既有恢复尝试后仍无法解析 JSON                                                      |
| `OUTPUT_SCHEMA_INVALID` | 字段不合格；查看 `issues.field/code/limit`、`summaryLength`                            |
| `SAVE_FAILED`           | 模型输出已通过校验，但数据库保存失败                                                   |
| `PROVIDER_*`            | 认证、余额、限流、网络、超时或供应商服务错误                                           |

日志只记录允许的元数据，不记录模型正文、原始错误消息、密钥或完整响应。`model_output_accepted` 仅表示输出通过校验，不能单独证明数据库已保存成功。缺失的结束原因标为 `missing`，不能按正常结束推断。

排查时优先使用新闻详情中的单条分析，或经过 `ADMIN_SECRET` 鉴权的 `POST /api/analyze`，一次只提交一个 `newsId`。解析或字段校验失败不会自动重试模型；页面会给出分类提示，原结果保留。不要使用全部重分析来定位单条故障。

短新闻分析使用非思考模式（`reasoning_effort=none`）和 JSON Output，生成预算上限 1024 Tokens。提示词要求摘要 10–500 字符、板块最多 3 个，与校验规则一致。模型仍可能违反约束；不合格或截断的输出保留失败状态，不会自动重复收费调用。真实调用仍会产生供应商费用。

## 检查与部署

执行 `npx tsc --noEmit`、`npm run lint` 和 `npm run build`，并使用独立数据库验证采集、分析、筛选、错误处理和分页。部署前确认环境变量、数据库备份和恢复流程、管理员密钥以及定时任务是否符合套餐限制。部署后查看运行日志，并核对实际最新采集时间；构建成功不能证明数据链路正常。

生产构建脚本只生成 Prisma Client 并构建应用，不会自动修改数据库 schema。部署前仍须完成数据库迁移方案与验证。

发布前请确认上述配置、数据保护和验证步骤均已完成。
