import { fetchAllSources } from "../src/lib/rss/fetcher";
import { PAUSED_RSS_SOURCES } from "../src/lib/rss/sources";

// 只检查来源可达性，不写入数据库或调用模型。
async function main() {
  const results = await fetchAllSources();
  for (const source of PAUSED_RSS_SOURCES) {
    console.log(`${source.name}: 已暂停；${source.reason}`);
  }
  for (const result of results) {
    console.log(
      `${result.sourceName}: ${result.error ? `失败：${result.error}` : `成功，${result.items.length} 条`}`,
    );
  }
  // 任一启用来源失败都让检查失败，不能用其他来源成功掩盖局部故障。
  if (results.length === 0 || results.some((result) => result.error)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
