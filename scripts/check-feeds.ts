import { fetchAllSources } from "../src/lib/rss/fetcher";

// 只检查来源可达性，不写入数据库或调用模型。
async function main() {
  const results = await fetchAllSources();
  for (const result of results) {
    console.log(`${result.sourceName}: ${result.error ? `失败：${result.error}` : `成功，${result.items.length} 条`}`);
  }
  if (results.every((result) => result.error)) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
