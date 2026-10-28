import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import {
  command,
  freePort,
  temporaryDatabase,
  waitForServer,
} from "./test-database";

async function main() {
  const database = await temporaryDatabase();
  try {
    // 先验证旧 PostgreSQL 结构的基线接管及新闻保留，再验证新空库迁移。
    await database.pg.createDatabase("paper_legacy_test");
    const legacyUrl = database.url.replace(
      /\/paper_test$/,
      "/paper_legacy_test",
    );
    const legacy = database.pg.getPgClient("paper_legacy_test", "127.0.0.1");
    await legacy.connect();
    try {
      await legacy.query(
        await readFile(
          "prisma/migrations/20260429000000_postgresql_baseline/migration.sql",
          "utf8",
        ),
      );
      await legacy.query(
        'INSERT INTO "NewsItem" (id,title,link,source,"publishedAt","updatedAt","analyzedAt",summary) VALUES ($1,$2,$3,$4,NOW(),NOW(),NOW(),$5)',
        [
          "legacy",
          "合成迁移验证新闻",
          "https://example.invalid/legacy",
          "合成测试",
          "迁移前已存在的新闻摘要",
        ],
      );
    } finally {
      await legacy.end();
    }
    const legacyEnv = {
      ...database.env,
      DATABASE_URL: legacyUrl,
      DIRECT_URL: legacyUrl,
    };
    await command(
      [
        "node_modules/prisma/build/index.js",
        "migrate",
        "resolve",
        "--applied",
        "20260429000000_postgresql_baseline",
      ],
      legacyEnv,
    );
    await command(
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      legacyEnv,
    );
    const legacyClient = new PrismaClient({
      datasources: { db: { url: legacyUrl } },
    });
    try {
      const item = await legacyClient.newsItem.findUniqueOrThrow({
        where: { id: "legacy" },
      });
      if (
        item.summary !== "迁移前已存在的新闻摘要" ||
        item.analysisStatus !== "legacy"
      )
        throw new Error("Legacy news preservation failed");
      console.log("PASS: existing PostgreSQL baseline upgrade preserves news");
    } finally {
      await legacyClient.$disconnect();
    }
    await command(
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      database.env,
    );
    if (process.argv.includes("--http")) {
      const port = await freePort(),
        origin = `http://127.0.0.1:${port}`;
      const server = spawn(
        process.execPath,
        [
          "node_modules/next/dist/bin/next",
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(port),
        ],
        { env: database.env, stdio: "ignore", windowsHide: true },
      );
      try {
        await waitForServer(origin, server);
        await command(
          [
            "node_modules/tsx/dist/cli.mjs",
            "--test",
            "tests/paper/http.test.ts",
          ],
          {
            ...database.env,
            TEST_ORIGIN: origin,
            TEST_LOGIN_PASSWORD: database.loginPassword,
          },
        );
      } finally {
        server.kill();
        await new Promise<void>((resolve) => {
          if (server.exitCode !== null) resolve();
          else server.once("exit", () => resolve());
        });
      }
    } else {
      await command(
        [
          "node_modules/tsx/dist/cli.mjs",
          "--test",
          "tests/paper/integration.test.ts",
        ],
        database.env,
      );
    }
  } finally {
    await database.stop();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message.replace(
          /postgres(?:ql)?:\/\/[^\s]+/g,
          "[local test database]",
        )
      : "Integration tests failed",
  );
  process.exit(1);
});
