import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/paper/session";

// 仅在用户终端显示一次；脚本不写文件，仓库不保存明文登录口令。
const password = randomBytes(24).toString("base64url");
console.log("请将下列随机口令保存在密码管理器，用于实验区登录：\n" + password);
console.log("\n将以下两个值配置在部署平台的服务端环境变量中：");
console.log("PAPER_PASSWORD_HASH=" + hashPassword(password));
console.log("PAPER_SESSION_SECRET=" + randomBytes(32).toString("hex"));
console.log("CRON_SECRET=" + randomBytes(32).toString("hex"));
