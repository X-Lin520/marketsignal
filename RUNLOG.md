# MarketSignal — 运行日志

## 2026-04-29 项目初始化

```
[17:36] 项目目录 f:\学习\信息汇总\marketsignal\ 创建
[17:40] Next.js 16.2.4 脚手架完成 (TypeScript + Tailwind + App Router)
[17:42] 核心依赖安装: @prisma/client, @anthropic-ai/sdk, zod, rss-parser, next-themes, lucide-react, date-fns
[17:43] Dev 依赖安装: prisma, ts-node, tsx, prettier
[17:45] shadcn/ui 初始化 (Base UI variant)
[17:46] UI 组件安装: button, card, badge, scroll-area, skeleton, sheet, separator, select, toggle, toggle-group, tooltip
[17:50] Bloomberg 暗黑主题 CSS 变量配置完成
[17:52] 环境变量 .env.local / .env.example 创建
[17:53] Prisma Schema 编写 → 切换 SQLite 本地开发
[17:55] Prisma 迁移执行 → dev.db 创建
[17:56] PrismaClient 单例 (lib/db/prisma.ts)
[17:57] ThemeProvider + RootLayout + Header + Footer + globals.css
[17:58] Phase 1 构建验证: npx next build → ✓ 零错误
[17:59] Phase 1 完成
```

## 2026-04-29 Phase 2: 数据管道 + AI 集成

```
[18:00] RSS 管道 6 模块完成: types → sources → fetcher → parser → noise-filter → deduplicator
[18:05] AI 分析 4 模块完成: client → prompt → parser → pipeline
[18:10] API 路由 4 条完成: cron/ingest, news, news/[id], analyze
[18:12] vercel.json Cron 配置 (每 5 分钟)
[18:15] 种子脚本 10 条数据写入
[18:16] 构建验证: ✓ 零错误
[18:18] API 测试:
       GET  /api/news?limit=3          → 200 (10 items)
       GET  /api/news/[id]              → 200 (单条详情)
       POST /api/cron/ingest (无 token)  → 401 Unauthorized
       POST /api/cron/ingest (有 token)  → 200 (fetched:40, new:40, analyzed:42)
[18:20] 数据总量: 50 条 (10 seed + 40 ingest)
       部分 RSS 源受限: Reuters 404, Bloomberg timeout, Yahoo Finance ECONNRESET, Investing.com 403
[18:21] Phase 2 完成
```

## 2026-04-29 Phase 3: 前端仪表盘

```
[18:25] 仪表盘组件完成: NewsCard, SkeletonCard, NewsDetailSheet, DashboardHeader, NewsFilter, NewsTimeline
[18:30] page.tsx 服务端数据获取 + DashboardClient 客户端交互
[18:32] loading.tsx / error.tsx 完成
[18:35] 构建验证: ✓ 零错误
[18:38] API 筛选测试全部通过:
       情感筛选    → Bullish only ✓
       来源筛选    → CNBC only   ✓
       板块筛选    → Technology  ✓
[18:40] Phase 3 完成
```

## 2026-04-29 中英双语切换

```
[19:00] 翻译词典完成: src/lib/i18n/translations.ts (en + zh, 全量覆盖)
[19:02] LanguageProvider + LanguageToggle 完成
[19:05] 全部组件接入 i18n
[19:08] 构建验证: ✓ 零错误
[19:10] Cookie 同步机制修复 SSR 水合错误
       默认无 cookie → 英文界面      ✓
       zh cookie    → 中文界面      ✓
       en cookie    → 英文界面      ✓
```

## 2026-04-29 AI 配置与优化

```
[20:00] ANTHROPIC_API_KEY 配置完成
[20:02] ENABLE_AI 开关加入 .env.local
[20:05] 手动触发抓取:
       curl POST /api/cron/ingest → fetched:40, new:0, analyzed:0
       (无新数据，链路验证通过)
[20:10] 新版 Prompt 上线:
       - 角色: 对冲基金高级分析师
       - 强制输出板块 (≥1)
       - 强制输出交易建议 (never null)
       - 情绪默认倾向 Bullish/Bearish
[20:12] 模型更新: claude-sonnet-4-20250514 → claude-sonnet-4-6-20250914
[20:15] max_tokens: 400 → 600 (修复 JSON 截断)
[20:20] JSON 解析器三层容错: 标准解析 → 截断修复 → 正则提取
```

## 2026-04-29 批量重分析

```
[21:00] 执行: npx tsx scripts/reanalyze-all.ts
[21:02] 总计 60 条，并发 5，批次间隔 500ms
[21:03] 完成: 48/60 成功, 12/60 失败 (JSON 解析)
[21:03] 情绪分布变化:
       Bullish:   8 → 24  (+200%)
       Bearish:   7 → 20  (+186%)
       Neutral:  45 → 16  (-64%)
[21:05] 重分析后验证:
       GET /api/stats → totalNews:60, bullish:24, bearish:20, neutral:16
```

## 2026-04-29 前端自动刷新

```
[21:30] 2 分钟轮询机制完成 (setInterval → /api/stats)
[21:32] 标签页唤醒刷新 (visibilitychange 事件)
[21:33] 手动刷新按钮 + MM:SS 倒计时
[21:34] NewsFilter SSR 修复 (dynamic import, ssr: false)
[21:35] 构建验证: ✓ 零错误
[21:36] /api/stats 端点新增
```

## 2026-04-29 详情弹窗重构

```
[22:00] Dialog 组件安装 (shadcn add dialog)
[22:05] Sheet → Dialog: 右侧滑出 → 居中弹出
[22:08] 视觉层次重构:
       - 情绪横幅: 圆角徽章 + 大图标 + 双语标签
       - AI 摘要:   Card + FileText 图标
       - 影响板块:  Card + Layers 图标 + 大号 Badge
       - 投资洞察:  独立 Card + 琥珀色高亮框
[22:10] 构建验证: ✓ 零错误
```

## 2026-04-29 文档完善

```
[22:20] README.md 完成:
       - 项目简介 + 核心能力
       - 快速开始 (6 步)
       - 使用指南 (筛选、详情、手动抓取、重分析、语言切换)
       - API 接口文档 (5 条路由 + 示例)
       - 生产部署 (GitHub → Supabase → Vercel)
       - 常见问题 (4 FAQ)
       - 免责声明
[22:25] RUNLOG.md 本日志文件
```

---

## 当前系统状态

| 指标 | 数值 |
|------|------|
| 数据库总量 | 60 条 |
| Bullish / Bearish / Neutral | 24 / 20 / 16 |
| RSS 可用源 | CNBC, MarketWatch (4 源受限) |
| AI 模型 | claude-sonnet-4-6-20250914 |
| 接口数量 | 5 个 API + 1 个统计端点 |
| 前端组件 | 6 个仪表盘组件 + 11 个 UI 组件 |
| TypeScript 错误 | 0 |
| 构建状态 | ✅ 通过 |

---

## 启动命令速查

```bash
# 开发
npm run dev

# 构建
npm run build

# 手动抓取 (PowerShell)
curl.exe -X POST http://localhost:3000/api/cron/ingest -H "Authorization: Bearer dev-secret-change-in-production"

# 查看统计
curl.exe http://localhost:3000/api/stats

# 查看新闻
curl.exe "http://localhost:3000/api/news?limit=5"

# 批量重分析
npx tsx scripts/reanalyze-all.ts

# 数据库 GUI
npx prisma studio
```
