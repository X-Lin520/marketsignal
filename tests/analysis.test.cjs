/* eslint-disable @typescript-eslint/no-require-imports -- 测试隔离加载 CommonJS 模块 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { randomBytes } = require("node:crypto");
const path = require("node:path");

function load(file, mocks = {}, env = {}, logs = []) {
  const cache = new Map();
  function compile(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = fs.readFileSync(filename, "utf8");
    const code = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const testModule = { exports: {} };
    cache.set(filename, testModule);
    vm.runInNewContext(code, {
      module: testModule,
      exports: testModule.exports,
      require: (name) => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name.startsWith("."))
          return compile(path.resolve(path.dirname(filename), name + ".ts"));
        if (name.startsWith("@/"))
          return compile(path.resolve("src", name.slice(2) + ".ts"));
        return require(name);
      },
      process: { env },
      console: Object.fromEntries(
        ["error", "warn", "info"].map((level) => [
          level,
          (...args) => logs.push({ level, args }),
        ]),
      ),
      setTimeout,
      Buffer,
    });
    return testModule.exports;
  }
  return compile(path.resolve(file));
}

test("损坏的 AI 结果不会被当作中性分析", () => {
  const parser = load("src/lib/ai/parser.ts", {});
  assert.throws(
    () => parser.parseAiResponse("invalid JSON"),
    (error) => error.diagnostic.code === "OUTPUT_INVALID_JSON",
  );
});

test("旧版失败占位被识别，但真实摘要不会被误判", () => {
  const legacy = load("src/lib/ai/legacy.ts", {});
  assert.equal(
    legacy.isLegacyPlaceholder("Unable to analyze this article."),
    true,
  );
  assert.equal(legacy.isLegacyPlaceholder("[Pending analysis] Example"), true);
  assert.equal(legacy.isLegacyPlaceholder("Genuine market analysis."), false);
  assert.equal(legacy.isLegacyPlaceholder(null), false);
});

test("AI 关闭时不读取或写入新闻", async () => {
  let touched = false;
  const pipeline = load(
    "src/lib/ai/pipeline.ts",
    {
      "@/lib/db/prisma": {
        prisma: {
          newsItem: {
            findMany() {
              touched = true;
            },
          },
        },
      },
      "./client": {},
      "./errors": { safeAiError: () => "error" },
    },
    { ENABLE_AI: "false" },
  );
  const result = await pipeline.runAnalysisPipeline();
  assert.equal(result.analyzed, 0);
  assert.equal(touched, false);
});

test("供应商错误只显示安全提示，不暴露原始密钥片段", () => {
  const { safeAiError } = load("src/lib/ai/errors.ts", {});
  const marker = randomBytes(12).toString("hex");
  assert.equal(
    safeAiError({ status: 401, message: marker }).includes(marker),
    false,
  );
  assert.match(safeAiError({ status: 401 }), /认证失败/);
});

test("解析和保存错误分别提示且不暴露原始内容", () => {
  const diagnostics = load("src/lib/ai/diagnostics.ts");
  const { safeAiError } = load("src/lib/ai/errors.ts", {
    "./diagnostics": diagnostics,
  });
  assert.match(
    safeAiError(
      new diagnostics.AnalysisDiagnosticError({ code: "OUTPUT_INVALID_JSON" }),
    ),
    /格式异常/,
  );
  assert.match(
    safeAiError(
      new diagnostics.AnalysisDiagnosticError({ code: "SAVE_FAILED" }),
    ),
    /保存失败/,
  );
  assert.match(safeAiError({ status: 503 }), /服务暂时不可用/);
});

test("模型客户端使用 DeepSeek 接口和模型", async () => {
  let options, request;
  class FakeClient {
    constructor(config) {
      options = config;
      this.chat = {
        completions: {
          create: async (params) => {
            request = params;
            return {
              choices: [{ finish_reason: "stop", message: { content: "ok" } }],
            };
          },
        },
      };
    }
  }
  const client = load(
    "src/lib/ai/client.ts",
    {
      openai: { __esModule: true, default: FakeClient },
      "./prompt": { SYSTEM_PROMPT: "test", buildUserMessage: () => "test" },
      "./parser": {
        parseAiResponse: () => ({ summary: "Valid test summary." }),
      },
    },
    { OPENAI_API_KEY: randomBytes(24).toString("hex") },
  );
  await client.analyzeNewsItem({});
  assert.equal(options.baseURL, "https://api.deepseek.com");
  assert.equal(request.model, "deepseek-flash");
  assert.equal(request.reasoning_effort, "none");
  assert.equal(request.response_format.type, "json_object");
  assert.equal(request.max_tokens, 1024);
});

test("相同批次的重复链接只保留一次", async () => {
  const dedup = load("src/lib/rss/deduplicator.ts", {
    "@/lib/db/prisma": { prisma: { newsItem: { findMany: async () => [] } } },
  });
  const result = await dedup.deduplicate([
    { link: "https://example.com/a" },
    { link: "https://example.com/a" },
  ]);
  assert.equal(result.length, 1);
});

test("定时任务密钥与公开变量相同时，拒绝运行", async () => {
  const key = randomBytes(24).toString("hex");
  const mocks = {
    "next/server": {
      NextResponse: {
        json: (data, init = {}) => ({ data, status: init.status ?? 200 }),
      },
    },
    "@/lib/rss/fetcher": {},
    "@/lib/rss/noise-filter": {},
    "@/lib/rss/deduplicator": {},
    "@/lib/ai/pipeline": {},
    "@/lib/db/prisma": {},
    "@/lib/auth": { authorized: () => true },
  };
  const route = load("src/app/api/cron/ingest/route.ts", mocks, {
    CRON_SECRET: key,
    NEXT_PUBLIC_CRON_SECRET: key,
  });
  const response = await route.GET({});
  assert.equal(response.status, 503);
});

test("重新分析失败时保留历史结果，成功后才更新", async () => {
  const key = randomBytes(24).toString("hex");
  const rows = [
    { id: "one", title: "first" },
    { id: "two", title: "second" },
  ];
  const writes = [];
  const route = load(
    "src/app/api/reanalyze/route.ts",
    {
      "next/server": {
        NextResponse: {
          json: (data, init = {}) => ({ data, status: init.status ?? 200 }),
        },
      },
      "@/lib/auth": { authorized: (request, secret) => request.key === secret },
      "@/lib/db/prisma": {
        prisma: {
          newsItem: {
            findMany: async () => rows,
            update: async (data) => writes.push(data),
          },
        },
      },
      "@/lib/ai/client": {
        analyzeNewsItem: async (row) => {
          if (row.id === "one") throw new Error("offline");
          return {
            summary: "new",
            sentiment: "Bullish",
            impactSectors: [],
            actionableAdvice: null,
          };
        },
      },
      "@/lib/ai/errors": { safeAiError: () => "safe error" },
    },
    { ADMIN_SECRET: key, ENABLE_AI: "true", OPENAI_API_KEY: "test-only-value" },
  );
  const response = await route.POST({
    key,
    json: async () => ({ newsIds: ["one", "two"] }),
  });
  assert.equal(response.data.succeeded, 1);
  assert.equal(response.data.failed, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].where.id, "two");
  const denied = await route.POST({ key: "wrong" });
  assert.equal(denied.status, 401);
});

const validAnalysis = {
  summary: "A valid summary of the market news.",
  sentiment: "Bullish",
  impactSectors: ["Technology"],
  actionableAdvice: "Observe the market.",
};

test("批量分析拒绝旧游标、超额和重复条目，避免意外遍历全库", async () => {
  let touched = false;
  const route = load(
    "src/app/api/reanalyze/route.ts",
    {
      "next/server": {
        NextResponse: {
          json: (data, init = {}) => ({ data, status: init.status ?? 200 }),
        },
      },
      "@/lib/auth": { authorized: () => true },
      "@/lib/db/prisma": {
        prisma: {
          newsItem: {
            findMany: async () => {
              touched = true;
              return [];
            },
          },
        },
      },
      "@/lib/ai/client": {},
    },
    { ENABLE_AI: "true", OPENAI_API_KEY: "test-only-value" },
  );
  for (const body of [
    { cursor: null },
    { newsIds: [] },
    { newsIds: ["a", "a"] },
    { newsIds: Array.from({ length: 11 }, (_, i) => String(i)) },
  ]) {
    const response = await route.POST({ json: async () => body });
    assert.equal(response.status, 400);
  }
  assert.equal(touched, false);
});
const sampleNews = {
  id: "c" + "1".repeat(24),
  title: "Synthetic market news",
  source: "Test",
  publishedAt: new Date("2026-10-29T00:00:00Z"),
  link: "https://example.com/news",
  contentSnippet: "Synthetic test data.",
};

function modelMock(response, onCall = () => {}) {
  return {
    __esModule: true,
    default: class {
      constructor() {
        this.chat = {
          completions: {
            create: async () => {
              onCall();
              return response;
            },
          },
        };
      }
    },
  };
}

test("摘要长度校验保留准确的字段、上限和实际长度", () => {
  const { parseAiResponse } = load("src/lib/ai/parser.ts");
  assert.equal(
    parseAiResponse(
      JSON.stringify({ ...validAnalysis, summary: "a".repeat(500) }),
    ).summary.length,
    500,
  );
  assert.throws(
    () =>
      parseAiResponse(
        JSON.stringify({ ...validAnalysis, summary: "a".repeat(501) }),
      ),
    (error) => {
      assert.equal(error.diagnostic.code, "OUTPUT_SCHEMA_INVALID");
      assert.equal(error.diagnostic.summaryLength, 501);
      assert.equal(error.diagnostic.issues[0].field, "summary");
      assert.equal(error.diagnostic.issues[0].code, "too_big");
      assert.equal(error.diagnostic.issues[0].limit, 500);
      return true;
    },
  );
});

test("缺少情绪字段与损坏 JSON 具有不同诊断", () => {
  const { parseAiResponse } = load("src/lib/ai/parser.ts");
  const missing = { ...validAnalysis };
  delete missing.sentiment;
  assert.throws(
    () => parseAiResponse(JSON.stringify(missing)),
    (error) => {
      assert.equal(error.diagnostic.code, "OUTPUT_SCHEMA_INVALID");
      assert.ok(
        error.diagnostic.issues.some((issue) => issue.field === "sentiment"),
      );
      return true;
    },
  );
  assert.throws(
    () => parseAiResponse('{"summary":"unfinished'),
    (error) => error.diagnostic.code === "OUTPUT_INVALID_JSON",
  );
});

test("诊断日志拒绝未知文本、原始内容、错误消息和无效数值", () => {
  const logs = [];
  const diagnostics = load("src/lib/ai/diagnostics.ts", {}, {}, logs);
  const marker = randomBytes(24).toString("hex");
  diagnostics.logAiDiagnostic(
    {
      code: marker,
      finishReason: marker,
      raw: marker,
      message: marker,
      contentLength: -1,
      summaryLength: Infinity,
      issues: [{ field: marker, code: marker, limit: marker }],
    },
    { operation: marker, newsId: marker },
  );
  const serialized = JSON.stringify(logs);
  assert.equal(serialized.includes(marker), false);
  const entry = JSON.parse(logs[0].args[1]);
  assert.equal(entry.code, "PROVIDER_ERROR");
  assert.equal(entry.finishReason, "other");
  assert.equal(entry.issues[0].field, "other");
  assert.equal(entry.contentLength, undefined);
});

test("达到 Token 上限时，即使正文是合法 JSON 也不能写成完整分析", async () => {
  const logs = [];
  let calls = 0;
  const client = load(
    "src/lib/ai/client.ts",
    {
      openai: modelMock(
        {
          choices: [
            {
              finish_reason: "length",
              message: { content: JSON.stringify(validAnalysis) },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 600,
            completion_tokens_details: { reasoning_tokens: 350 },
          },
        },
        () => calls++,
      ),
    },
    { OPENAI_API_KEY: randomBytes(24).toString("hex") },
    logs,
  );
  await assert.rejects(
    client.analyzeNewsItem(sampleNews, {
      operation: "analyze",
      newsId: sampleNews.id,
    }),
    (error) => error.diagnostic.code === "OUTPUT_TRUNCATED",
  );
  assert.equal(calls, 1);
  const entry = JSON.parse(logs[0].args[1]);
  assert.equal(entry.finishReason, "length");
  assert.equal(entry.completionTokens, 600);
  assert.equal(entry.reasoningTokens, 350);
  assert.equal(entry.newsId, sampleNews.id);
  assert.equal(JSON.stringify(logs).includes(validAnalysis.summary), false);
});

test("空输出单独归类，不误报成 JSON 解析或数据库错误", async () => {
  const client = load(
    "src/lib/ai/client.ts",
    {
      openai: modelMock({
        choices: [{ finish_reason: "stop", message: { content: "" } }],
      }),
    },
    { OPENAI_API_KEY: randomBytes(24).toString("hex") },
  );
  await assert.rejects(
    client.analyzeNewsItem(sampleNews),
    (error) => error.diagnostic.code === "OUTPUT_EMPTY",
  );
});

test("缺失结束原因的响应不能被当作完整分析", async () => {
  const client = load(
    "src/lib/ai/client.ts",
    {
      openai: modelMock({
        choices: [{ message: { content: JSON.stringify(validAnalysis) } }],
      }),
    },
    { OPENAI_API_KEY: randomBytes(24).toString("hex") },
  );
  await assert.rejects(
    client.analyzeNewsItem(sampleNews),
    (error) => error.diagnostic.code === "OUTPUT_INTERRUPTED",
  );
});

test("单条解析失败只调用一次模型、保留待分析并记录具体校验信息", async () => {
  const logs = [];
  let calls = 0,
    writes = 0;
  const marker = randomBytes(24).toString("hex");
  const content = JSON.stringify({
    ...validAnalysis,
    summary: marker + "a".repeat(501),
  });
  const pipeline = load(
    "src/lib/ai/pipeline.ts",
    {
      "@/lib/db/prisma": {
        prisma: {
          newsItem: {
            findMany: async () => [sampleNews],
            update: async () => {
              writes++;
            },
          },
        },
      },
      openai: modelMock(
        {
          choices: [{ finish_reason: "stop", message: { content } }],
          usage: { completion_tokens: 250 },
        },
        () => calls++,
      ),
    },
    { ENABLE_AI: "true", OPENAI_API_KEY: randomBytes(24).toString("hex") },
    logs,
  );
  const result = await pipeline.runAnalysisPipeline();
  assert.equal(result.analyzed, 0);
  assert.equal(result.failed, 1);
  assert.equal(writes, 0);
  assert.equal(calls, 1);
  const entry = JSON.parse(logs[0].args[1]);
  assert.equal(entry.code, "OUTPUT_SCHEMA_INVALID");
  assert.equal(entry.finishReason, "stop");
  assert.equal(entry.summaryLength, marker.length + 501);
  assert.equal(entry.issues[0].field, "summary");
  assert.equal(JSON.stringify(logs).includes(marker), false);
});

test("单条分析保存失败明确归类且不泄漏数据库错误", async () => {
  const logs = [];
  const diagnostics = load("src/lib/ai/diagnostics.ts", {}, {}, logs);
  const key = randomBytes(24).toString("hex");
  const marker = randomBytes(24).toString("hex");
  const route = load(
    "src/app/api/analyze/route.ts",
    {
      "next/server": {
        NextResponse: {
          json: (data, init = {}) => ({ data, status: init.status ?? 200 }),
        },
      },
      "@/lib/auth": { authorized: (request) => request.key === key },
      "@/lib/db/prisma": {
        prisma: {
          newsItem: {
            findUnique: async () => sampleNews,
            update: async () => {
              throw new Error(marker);
            },
          },
        },
      },
      "@/lib/ai/client": { analyzeNewsItem: async () => validAnalysis },
      "@/lib/utils/helpers": { parseSectors: (value) => value },
      "@/lib/ai/errors": load("src/lib/ai/errors.ts", {
        "./diagnostics": diagnostics,
      }),
      "@/lib/ai/diagnostics": diagnostics,
    },
    { ENABLE_AI: "true", OPENAI_API_KEY: randomBytes(24).toString("hex") },
    logs,
  );
  const response = await route.POST({
    key,
    json: async () => ({ newsId: sampleNews.id }),
  });
  assert.equal(response.status, 500);
  assert.match(response.data.error, /保存失败/);
  assert.equal(JSON.parse(logs[0].args[1]).code, "SAVE_FAILED");
  assert.equal(JSON.stringify({ logs, response }).includes(marker), false);
});
