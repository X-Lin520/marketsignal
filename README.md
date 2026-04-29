# MarketSignal — AI 驱动的股市情报监控仪表盘

## 项目简介

MarketSignal 是一个 24 小时自动化财经新闻监控与分析平台。它定期抓取全球权威财经媒体的 RSS 新闻源，利用 Claude 大语言模型对每条新闻进行智能分析，生成市场情绪判断、行业影响评估和可操作的投资建议，并通过 Bloomberg 终端风格的暗黑模式仪表盘集中展示。

### 解决的核心问题

- **信息过载**：每天数千条财经新闻，人工无法逐一阅读
- **噪音干扰**：广告、软文、非财经内容充斥 RSS 源
- **分析滞后**：依赖人工解读，错过短线交易窗口

### 核心能力

| 能力 | 说明 |
|------|------|
| RSS 自动抓取 | 每 5 分钟从 CNBC、MarketWatch 等源拉取最新资讯 |
| 智能去噪 | 自动过滤广告、观点文、过时新闻 |
| AI 情绪分析 | Claude 模型判断每条新闻的 Bullish / Bearish / Neutral |
| 行业识别 | 自动标注受影响的行业板块（Technology、Energy 等） |
| 交易建议 | 生成具体、可操作的短线投资策略 |
| 暗黑仪表盘 | Bloomberg 终端风格 UI，支持中英文切换 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + TypeScript + React 19 |
| 样式 | Tailwind CSS v4 + shadcn/ui (Base UI) |
| 数据库 | SQLite（本地开发）/ Supabase PostgreSQL（生产） |
| ORM | Prisma 6 |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| 定时任务 | Vercel Cron Jobs（生产）/ 手动触发（开发） |

---

## 快速开始

### 1. 环境要求

- Node.js 18+
- npm 9+

### 2. 安装依赖

```bash
cd marketsignal
npm install
```

### 3. 配置环境变量

项目根目录下已有 `.env.example` 模板文件。复制并编辑 `.env.local`：

```bash
# 数据库（本地开发直接用 SQLite，无需额外配置）
DATABASE_URL="file:./dev.db"

# Anthropic API Key（必填，否则 AI 分析将使用占位模式）
ANTHROPIC_API_KEY="sk-ant-api03-你的真实Key"

# AI 开关（额度紧张时可设为 false 暂停 AI 调用）
ENABLE_AI=true

# 定时任务鉴权密钥（本地开发可用默认值）
CRON_SECRET="dev-secret-change-in-production"
```

### 4. 初始化数据库

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. 填充示例数据（可选）

```bash
npx tsx prisma/seed.ts
```

这会写入 10 条带有预置 AI 分析的模拟新闻，方便立即体验仪表盘效果。

### 6. 启动开发服务器

```bash
npm run dev
```

浏览器打开 `http://localhost:3000` 即可看到仪表盘。

---

## 使用指南

### 仪表盘界面

```
┌──────────────────────────────────────────────────┐
│ 📊 MarketSignal              中文 | ☀ | ↻ 01:23 │  ← 顶栏
├──────────────────────────────────────────────────┤
│ 📰 总计 60    📈 利好 24    📉 利空 20    ➖ 中性 16 │  ← 统计栏
│                         🕐 更新于 3h ago          │     (每2分钟自动刷新)
├──────────────────────────────────────────────────┤
│ [利好] [利空] [中性]   [全部来源 ▼] [全部板块 ▼]    │  ← 筛选栏
├──────────────────────────────────────────────────┤
│ ▌ CNBC · 2h ago                                  │
│ ▌ Trump threatens Iran with AI picture...        │  ← 新闻卡片
│ ▌ Bearish | Energy, Industrials...               │     (绿/红/灰左边条)
│ ▌ Short airline ETFs, long crude oil futures...  │
├──────────────────────────────────────────────────┤
│ ▌ CNBC · 3h ago                                  │
│ ▌ OpenAI's subtle drift from Microsoft...        │
│ ▌ Bullish | Technology                           │
├──────────────────────────────────────────────────┤
│         [ 加载更多 (52 remaining) ]               │  ← 分页
├──────────────────────────────────────────────────┤
│  AI 分析仅供参考，不构成投资建议 (NFA)              │  ← 免责声明
└──────────────────────────────────────────────────┘
```

### 筛选新闻

- **情绪筛选**：点击顶部的 `利好` / `利空` / `中性` 按钮，筛选对应情绪的新闻。再次点击取消筛选
- **来源筛选**：下拉菜单选择特定媒体（CNBC、Reuters 等）
- **板块筛选**：下拉菜单选择特定行业（Technology、Energy 等）
- **清除筛选**：点击 `Clear` 按钮重置所有筛选条件

筛选参数会同步到 URL（如 `?sentiment=Bullish&source=CNBC`），可分享筛选后的页面链接。

### 查看详情

点击任意新闻卡片，页面正中弹出分析详情弹窗。弹窗包含四个层次分明的区块：

1. **情绪横幅** — 顶部彩色区块显示 AI 判断的市场情绪，绿色利好 / 红色利空 / 灰色中性，附带大图标和双语标签
2. **AI 摘要** — 带背景卡片包裹的 2-3 句话 Bloomberg 风格总结
3. **影响板块** — 受影响的行业标签，以独立卡片呈现
4. **投资洞察** — 琥珀色高亮的交易建议，含具体标的和操作方向

按 `Esc` 键或点击遮罩层关闭弹窗。

### 手动抓取新闻

开发环境下，Vercel Cron 不会自动运行。使用以下命令手动触发新闻抓取和 AI 分析：

**PowerShell：**
```powershell
curl.exe -X POST http://localhost:3000/api/cron/ingest -H "Authorization: Bearer dev-secret-change-in-production"
```

**Bash / Git Bash：**
```bash
curl -X POST http://localhost:3000/api/cron/ingest -H "Authorization: Bearer dev-secret-change-in-production"
```

返回示例：
```json
{
  "fetched": 40,
  "new": 12,
  "analyzed": 12,
  "errors": [
    "Reuters: Status code 404",
    "Bloomberg: Request timed out after 15000ms"
  ]
}
```

`fetched` 为本次抓取总数，`new` 为去重后新增数，`analyzed` 为 AI 分析成功数，`errors` 列出失败的源（网络问题，属正常现象）。

### 批量重分析

如果修改了 AI Prompt 或想用最新模型重新分析所有历史数据：

```bash
npx tsx scripts/reanalyze-all.ts
```

这会逐条调用 Claude 重新分析数据库中的每一条新闻，并用新结果覆盖旧数据。60 条数据约需 1-2 分钟。

### 暂停 / 恢复 AI 分析

当 API 额度紧张时，在 `.env.local` 中将 `ENABLE_AI` 设为 `false`：

```bash
ENABLE_AI=false
```

重启 `npm run dev` 后，新闻照常抓取和入库，但 AI 分析步骤跳过，界面显示 "分析中..."。恢复时改回 `true` 即可，未分析的条目会在下次 cron 触发时自动补完。

### 语言切换

点击顶栏的 `中文` / `EN` 按钮切换界面语言。偏好保存在浏览器中，刷新后保持不变。首次访问自动检测浏览器语言。

---

## API 接口

| 路由 | 方法 | 鉴权 | 用途 |
|------|------|------|------|
| `/api/cron/ingest` | POST | CRON_SECRET | 触发 RSS 抓取 → 去噪 → 去重 → AI 分析全流程 |
| `/api/news` | GET | 无 | 分页新闻列表，支持 `sentiment` / `source` / `sector` / `page` / `limit` 参数 |
| `/api/news/[id]` | GET | 无 | 单条新闻完整详情 |
| `/api/stats` | GET | 无 | 统计数据（总数 + 各情绪数量 + 最后更新时间） |
| `/api/analyze` | POST | CRON_SECRET | 手动对单条新闻重新 AI 分析 |

### 示例请求

```bash
# 获取第 2 页的利好新闻
curl http://localhost:3000/api/news?sentiment=Bullish&page=2&limit=10

# 获取统计数据
curl http://localhost:3000/api/stats

# 手动重新分析指定新闻
curl -X POST http://localhost:3000/api/analyze \
  -H "Authorization: Bearer dev-secret-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{"newsId":"cmok3dhjo000296dwxujpq7kv"}'
```

---

## 生产部署

### 1. 推送到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <你的仓库地址>
git push -u origin main
```

### 2. 创建 Supabase 项目

在 [supabase.com](https://supabase.com) 创建免费项目，获取连接字符串。

### 3. 修改数据库配置

更新 `prisma/schema.prisma`，将 provider 从 `sqlite` 改为 `postgresql`。

在 Vercel 项目 Settings → Environment Variables 中设置：

```bash
DATABASE_URL="postgresql://postgres.[ref]:[password]@[host].pooler.supabase.com:6543/postgres"
DIRECT_DATABASE_URL="postgresql://postgres.[ref]:[password]@[host].supabase.com:5432/postgres"
ANTHROPIC_API_KEY="sk-ant-api03-..."
CRON_SECRET="生成一个强随机字符串"
ENABLE_AI=true
```

### 4. 部署到 Vercel

在 [vercel.com](https://vercel.com) 导入 GitHub 仓库，部署后 Vercel Cron 会自动每 5 分钟触发 `/api/cron/ingest`。

### 5. 生产环境迁移数据库

```bash
npx prisma migrate deploy
```

---

## 常见问题

**Q: RSS 抓取报错 403/404/超时？**

A: 部分外媒 RSS 在国内网络环境下受限。CNBC 和 MarketWatch 通常可用。管道会跳过失败的源继续处理其他源，不影响整体运行。

**Q: AI 分析返回 Neutral 或空结果？**

A: 检查 `.env.local` 中 `ENABLE_AI` 是否为 `true`，API Key 是否填写正确。可通过 `npx tsx scripts/reanalyze-all.ts` 批量重分析。

**Q: 仪表盘没有数据显示？**

A: 数据库可能为空。先运行 `npx tsx prisma/seed.ts` 生成示例数据，或手动触发一次抓取。

**Q: 页面出现 Hydration 水合错误？**

A: 清除 `.next` 缓存后重启：`rm -rf .next && npm run dev`。

---

## 免责声明

**本平台所有 AI 生成的分析内容仅供参考，不构成任何投资建议（NFA）。** 过往表现不代表未来结果。在做出任何投资决策前，请务必自行研究并咨询持牌金融顾问。
