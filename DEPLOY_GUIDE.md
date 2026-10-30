# MarketSignal 新手部署指南

每位部署者使用自己的 GitHub、Vercel 和 AI 服务账户，AI 调用费用由该账户承担。账号申请、计费要求和界面可能随服务商变化。

```mermaid
flowchart LR
  A[准备 GitHub 和 Vercel 账号] --> B[Fork 项目]
  B --> C[申请自己的 AI API Key]
  C --> D[导入 Vercel 并填写环境变量]
  D --> E[部署完成后检查配置]
  E --> F[抓取新闻并按需分析]
```

## 1. 准备账号和密钥

1. 登录 GitHub，打开本项目页面，点击右上角 **Fork**，在自己的账户中创建副本。
2. 使用自己的 Vercel 账户并连接 GitHub。如果 Vercel 请求 GitHub 权限，先检查授权范围。
3. 选择一种 AI 服务：到 [DeepSeek 开放平台](https://platform.deepseek.com/) 或 [OpenAI 开发者平台](https://platform.openai.com/)注册并创建 API Key。不同服务商可能要求充值或开通计费，请在其官方平台查看。
4. 准备独立、随机、难猜的管理员密钥，用于授权抓取和分析。它与 AI API Key 是两种不同的密钥。不要把密钥提交到 GitHub 或发给其他人。

## 2. 在 Vercel 导入项目

进入 Vercel 控制台的项目创建入口，选择刚才 Fork 的仓库。找到 **Environment Variables**（环境变量）区域，分别填写：

| 名称 | 值 | 说明 |
| --- | --- | --- |
| `AI_PROVIDER` | `deepseek` 或 `openai` | 选一个，必须是小写英文 |
| `AI_API_KEY` | 所选服务商提供的 API Key | 不要写引号或多余空格 |
| `ENABLE_AI` | `true` | 开启分析；设为 `false` 可暂停 |
| `ADMIN_SECRET` | 自己设置的独立管理员密钥 | 抓取、分析和检查配置时输入 |

模型默认分别为 `deepseek-flash` 和 `gpt-4o-mini`。高级用户可额外设置 `AI_MODEL`，但需自行确认模型支持 JSON 输出及相应接口。不要设置 `NEXT_PUBLIC_AI_API_KEY` 或 `NEXT_PUBLIC_ADMIN_SECRET`。

确认变量应用于 **Production**，点击部署并等待完成。Preview 是独立环境：若要在预览站测试，需要单独配置 Preview 变量，且应使用独立密钥。修改环境变量后，需重新部署使新部署读取到更新值。

## 3. 首次使用

1. 打开正式网站，展开 **AI 配置与连接检查**，输入管理员密钥，点击 **检查配置**。此操作不调用模型；显示已配置不代表密钥或余额已验证。
2. 如需验证实际连通，在阅读费用提示后重新输入管理员密钥，点击 **测试连接**。该操作发送一次简短模型请求，可能产生费用。
3. 点击 **抓取最新新闻** 并输入管理员密钥；抓取不调用 AI。点击分析时才会产生模型调用。
4. 新闻和分析结果仅保存在当前页面，刷新页面后清空。

## 常见问题

- **管理员密钥错误或未配置**：确认访问的是正式站还是预览站，并检查对应环境的 `ADMIN_SECRET`；不要把密钥发送给他人。
- **AI 未配置或未启用**：检查 `AI_PROVIDER`、`AI_API_KEY`、`ENABLE_AI`，保存后重新部署。未配置 AI 时仍可抓取新闻，但抓取仍需管理员密钥。
- **AI 认证失败**：确认 API Key 与选定服务商对应，且该项目有权使用所选模型。OpenAI 选择需要填写 `AI_API_KEY`；不会使用旧 DeepSeek 的 `OPENAI_API_KEY`。
- **余额不足、限流或服务不可用**：在对应服务商的官方控制台检查余额、额度和状态；避免反复点击测试产生不必要的请求。
- **部分新闻源失败**：页面显示来源错误；某一来源失败时其他来源可能仍可用。

## 已有部署兼容

旧版本未设置 `AI_PROVIDER`、使用 `OPENAI_API_KEY` 保存 DeepSeek Key 时，仍默认使用 DeepSeek。若主动选择 `openai`，必须使用新的 `AI_API_KEY`，避免把旧 DeepSeek 密钥发送给 OpenAI。升级前检查现有环境配置并保留可回滚的部署。
