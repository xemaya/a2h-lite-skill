# a2h-lite-skill（已废弃）

> **⚠️ DEPRECATED — 2026-04-24**
>
> 本仓库的设计（SKILL.md 内嵌 bash bootstrap + `skill.a2hmarket.ai` CDN + 跨平台 `.claude.json` 自动写入）**已被废弃**。
>
> 新方案改走 **MCP 生态主流做法**：本地 TypeScript MCP server，通过 `npx -y @xemaya/a2h-mcp` 分发。
>
> 👉 **请使用 [@xemaya/a2h-mcp](https://github.com/xemaya/a2h-mcp)**

## 为什么切换

v1 方案要求用户跑 bash bootstrap，4 步：
1. 把 skill.md 放进 agent 平台
2. agent 执行 `bash <(curl -fsSL skill.a2hmarket.ai/bootstrap.sh)`
3. 浏览器授权
4. `claude mcp restart a2h`

v2 方案只需 1 步：
1. 在 `.mcp.json` 加：
   ```json
   { "mcpServers": { "a2h": { "command": "npx", "args": ["-y", "@xemaya/a2h-mcp"] } } }
   ```
2. 重启 Claude Code

首次在 agent 里让它调 `login` tool 即可完成授权。完全对齐 Supabase / Linear / Filesystem 等主流 MCP server 的安装方式。

## 历史归档

本仓库的 bash 脚本、跨平台 config 分发、CloudFront CDN 分发方案保留在 git log 作为设计参考。如果未来有类似“跨平台 skill 脚本一键分发”的需求，可以从 `62daa68` commit 开始翻。

- **v2 exec plan**：`aws_codebase/agent_tasks/exec-plans/2026-04-24-skill-mcp-v2-local.md`
- **v1 exec plan（已 superseded）**：`aws_codebase/agent_tasks/exec-plans/2026-04-24-skill-mcp-channel.md`

## AWS 基础设施

v1 建的 S3 bucket `a2h-skill-public` + CloudFront `E2O2CRWYCXOXTZ` + `skill.a2hmarket.ai` + IAM role `github-a2h-skill-deploy` 保留备用（月成本 < $1）。

不要删这些资源。未来做其他 skill 产物 CDN 分发时可以复用。
