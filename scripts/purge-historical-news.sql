-- 仅在新版本发布成功、确认目标项目且用户明确同意后手动执行。
-- 永久删除旧新闻及分析；不删除表结构、账户或其他表。
BEGIN;
DELETE FROM public."NewsItem";
COMMIT;
SELECT COUNT(*) AS remaining_news FROM public."NewsItem";
