/* eslint-disable @typescript-eslint/no-require-imports -- 只读诊断脚本使用 CommonJS */
// 使用合成数据复现解析边界，不联网、不调用模型、不访问数据库。
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
function compile(filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    require: (name) =>
      name.startsWith(".")
        ? compile(path.resolve(path.dirname(filename), name + ".ts"))
        : require(name),
    console: { error() {}, warn() {} },
  });
  return testModule.exports;
}
const parser = compile(path.join(projectRoot, "src/lib/ai/parser.ts"));

for (const characters of [450, 500, 501, 650]) {
  const response = JSON.stringify({
    summary: "a".repeat(characters),
    sentiment: "Bullish",
    impactSectors: ["Technology"],
    actionableAdvice: "Observe the market.",
  });
  let accepted = true;
  try {
    parser.parseAiResponse(response);
  } catch {
    accepted = false;
  }
  console.log(
    JSON.stringify({
      summaryCharacters: characters,
      validJson: true,
      accepted,
    }),
  );
}
