# RSS 修复与验证（2026-10-30）

## 处理结果

| 来源 | 处理 | 边界 |
| --- | --- | --- |
| Yahoo Finance | 从失效的 `/news/rssindex` 改为官方 `feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US` | 标普 500 相关新闻，不能视作原综合财经新闻的完整替代 |
| Reuters | 从启用列表移到明确的暂停列表，记录原因 | 旧 Reuters Agency RSS 实测 404；尚未确认可用的官方免费替代入口，不能宣称已恢复 Reuters 采集 |

其他 4 个来源地址保持原样。历史数据不删除，来源名称不改写，不把其他媒体标成 Reuters。Reuters 官方目前介绍的内容接入方式见 [Content Delivery](https://reutersagency.com/content-delivery-platforms/) 和 [Reuters MCP](https://reutersagency.com/reuters-mcp)；后者明确要求内容订阅和凭据。本次不购买或配置授权服务。

## 验证证据

- 新 Yahoo RSS 连续两次各解析出 20 条新闻，20 条均有标题和链接，最新记录日期为当天（2026-10-30）。
- 本地完整来源检查：CNBC 30 条、MarketWatch 10 条、Yahoo Finance 20 条；Bloomberg 超时、Investing.com 403。后两项是本地当前网络的实测结果，不能推断 Vercel 同样失败，也不能宣称全来源已通过。
- 检查脚本独立运行，不连接数据库、不调用模型；任一启用来源失败返回非零退出码。暂停来源单独打印原因，不计为成功。
- 拒绝把空 feed、缺失或仅空白标题/链接的条目集合当作有效抓取；部分来源失败时保留错误与其他来源的有效新闻。
- `rss-parser` 原超时只拒绝 Promise，不主动中止请求；为每个来源设置独立的 15 秒底层连接中止，避免检查完成后仍保留挂起连接。
- 20 项回归测试、TypeScript、相关代码 ESLint 检查通过；真实外部来源失败不被测试替身掩盖。

## 发布与后续核验

代码将通过独立 PR 和 Vercel 预览构建交付。尚未合并生产，尚未通过生产定时任务确认新 Yahoo 新闻入库。不得把预览构建成功等同于 RSS 数据链路验证。

生产发布后，在下一次正常采集的日志中确认 Yahoo 不再返回 404，并检查新记录来源、标题、链接与发布时间；不为验证 RSS 额外触发收费 AI 批次。Reuters 仍为暂停状态，恢复需另行确认可靠官方入口或用户已有授权。
