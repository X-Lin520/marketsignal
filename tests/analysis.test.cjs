/* eslint-disable @typescript-eslint/no-require-imports -- 测试隔离加载 CommonJS 模块 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { randomBytes } = require('node:crypto');

function load(file, mocks, env = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(code, { module: testModule, exports: testModule.exports, require: (name) => mocks[name] ?? require(name), process: { env }, console: { error() {}, warn() {} }, setTimeout, Buffer });
  return testModule.exports;
}

test('损坏的 AI 结果不会被当作中性分析', () => {
  const parser = load('src/lib/ai/parser.ts', {});
  assert.throws(() => parser.parseAiResponse('invalid JSON'), /could not be parsed/);
});

test('旧版失败占位被识别，但真实摘要不会被误判', () => {
  const legacy = load('src/lib/ai/legacy.ts', {});
  assert.equal(legacy.isLegacyPlaceholder('Unable to analyze this article.'), true);
  assert.equal(legacy.isLegacyPlaceholder('[Pending analysis] Example'), true);
  assert.equal(legacy.isLegacyPlaceholder('Genuine market analysis.'), false);
  assert.equal(legacy.isLegacyPlaceholder(null), false);
});

test('AI 关闭时不读取或写入新闻', async () => {
  let touched = false;
  const pipeline = load('src/lib/ai/pipeline.ts', { '@/lib/db/prisma': { prisma: { newsItem: { findMany() { touched = true; } } } }, './client': {} }, { ENABLE_AI: 'false' });
  const result = await pipeline.runAnalysisPipeline();
  assert.equal(result.analyzed, 0);
  assert.equal(touched, false);
});

test('相同批次的重复链接只保留一次', async () => {
  const dedup = load('src/lib/rss/deduplicator.ts', { '@/lib/db/prisma': { prisma: { newsItem: { findMany: async () => [] } } } });
  const result = await dedup.deduplicate([{ link: 'https://example.com/a' }, { link: 'https://example.com/a' }]);
  assert.equal(result.length, 1);
});

test('重新分析失败时保留历史结果，成功后才更新', async () => {
  const key = randomBytes(24).toString('hex');
  const rows = [{ id: 'one', title: 'first' }, { id: 'two', title: 'second' }];
  const writes = [];
  const route = load('src/app/api/reanalyze/route.ts', {
    'next/server': { NextResponse: { json: (data, init = {}) => ({ data, status: init.status ?? 200 }) } },
    '@/lib/auth': { authorized: (request, secret) => request.key === secret },
    '@/lib/db/prisma': { prisma: { newsItem: { findMany: async () => rows, update: async (data) => writes.push(data) } } },
    '@/lib/ai/client': { analyzeNewsItem: async (row) => { if (row.id === 'one') throw new Error('offline'); return { summary: 'new', sentiment: 'Bullish', impactSectors: [], actionableAdvice: null }; } },
  }, { ADMIN_SECRET: key, ENABLE_AI: 'true', OPENAI_API_KEY: 'test-only-value' });
  const response = await route.POST({ key, json: async () => ({ cursor: null }) });
  assert.equal(response.data.succeeded, 1);
  assert.equal(response.data.failed, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].where.id, 'two');
  const denied = await route.POST({ key: 'wrong' });
  assert.equal(denied.status, 401);
});
