import { randomBytes } from "node:crypto";
import { mkdtemp, symlink, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";
import { hashPassword } from "../src/lib/paper/session";

export async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Cannot allocate local port");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

export async function temporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "marketsignal-paper-"));
  const port = await freePort(),
    password = randomBytes(24).toString("hex");
  // Windows 的 initdb 会把中文 share 路径嵌入启动 SQL；ASCII 别名实验已确认可避开编码错误。
  let shareAlias: string | undefined;
  if (process.platform === "win32") {
    const require = createRequire(join(process.cwd(), "package.json"));
    const share = resolve(
      dirname(require.resolve("@embedded-postgres/windows-x64")),
      "../native/share",
    );
    shareAlias = join(directory, "share");
    await symlink(share, shareAlias, "junction");
  }
  const pg = new EmbeddedPostgres({
    databaseDir: join(directory, "pg"),
    user: "paper_test",
    password,
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: [
      "--locale=C",
      "--encoding=UTF8",
      ...(shareAlias ? ["-L", shareAlias] : []),
    ],
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("paper_test");
  const url = `postgresql://paper_test:${password}@127.0.0.1:${port}/paper_test`;
  const loginPassword = randomBytes(24).toString("base64url");
  const env = {
    ...process.env,
    DATABASE_URL: url,
    DIRECT_URL: url,
    TEST_DATABASE_URL: url,
    ENABLE_AI: "false",
    OPENAI_API_KEY: "",
    PAPER_PASSWORD_HASH: hashPassword(loginPassword),
    PAPER_SESSION_SECRET: randomBytes(32).toString("hex"),
    CRON_SECRET: randomBytes(32).toString("hex"),
  };
  return {
    pg,
    url,
    env,
    loginPassword,
    async stop() {
      await pg.stop();
      if (shareAlias) await unlink(shareAlias);
    },
  };
}

export function command(args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    child.stdout.on("data", (data) => {
      output += String(data);
    });
    child.stderr.on("data", (data) => {
      output += String(data);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const safe = output.replace(
        /postgres(?:ql)?:\/\/[^\s]+/g,
        "[local test database]",
      );
      if (code === 0) {
        console.log(safe.trim());
        resolve();
      } else reject(new Error(`Command failed (${code})\n${safe}`));
    });
  });
}

export async function waitForServer(origin: string, process: ChildProcess) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error("Preview process stopped");
    try {
      const result = await fetch(origin + "/paper", {
        signal: AbortSignal.timeout(5_000),
      });
      if (result.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Preview server timed out");
}
