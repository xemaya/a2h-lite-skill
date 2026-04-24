# @a2hmarket/a2h-skill-lite

一键安装 A2H Market AI 助手 skill 到 Claude Code / Openclaw / Hermes。

## 快速开始

```bash
npx -y @a2hmarket/a2h-skill-lite install
```

这会帮你：

- 在当前 agent 平台的 `.mcp.json` 里加入 `a2h` MCP server（指向 `@a2hmarket/a2h-mcp`）
- 在 `~/.claude/skills/` 写入 A2H skill 定义（让 CC 知道何时主动触发）
- 启动首次登录流程（浏览器授权）

## 使用

装完重启 Claude Code。在对话里说"问下 A2H 助手"、"帮我查 A2H 订单"等，CC 会自动用 a2h skill 的工具。

## 子命令

| 命令 | 作用 |
|---|---|
| `a2h-skill install` | 安装（配置 + 首次登录）|
| `a2h-skill install --no-login` | 只写配置，不触发登录 |
| `a2h-skill uninstall` | 移除配置（保留 credentials）|
| `a2h-skill status` | 查看当前安装状态 |
| `a2h-skill --help` | 帮助 |

### 选项

- `--api-base <url>` — 覆盖后端地址（例：`https://api-staging.a2hmarket.ai/a2hmarket-concierge`）。会写进 `.mcp.json` 的 `env.A2H_API_BASE`，同时传给本次 login 子进程。

## 环境变量

- `A2H_API_BASE`：测试/staging 时覆盖默认 prod URL
- `A2H_HOME`：默认 `~/.a2h`，测试时可覆盖 credentials 路径

## 工作原理

```
用户跑 npx -y @a2hmarket/a2h-skill-lite install
  ↓
detect-platform.ts 识别当前 agent 平台 (CC / Openclaw / Hermes)
  ↓
mcp-config.ts 合并写入 .mcp.json:
  {"mcpServers":{"a2h":{"command":"npx","args":["-y","@a2hmarket/a2h-mcp"]}}}
  ↓
skill-template.ts 写入 ~/.claude/skills/a2hmarket.md
  ↓
[可选] 自动跑 `npx -y -p @a2hmarket/a2h-mcp a2h-mcp-login` 启动 device flow
  ↓
提示用户重启 Claude Code
```

对 Claude Code 以外的平台（Openclaw / Hermes），逻辑一致但 config 路径不同；skill 格式目前仅 CC 已知，其他平台先只写 `.mcp.json`，内测期校准后再补 skill 分发。

## v1 历史

本仓库早期（`62daa68` 之前）是 bash bootstrap.sh + CDN 分发方案，v2 pivot 后作废。原 bash 脚本保留在 `scripts/` + `platforms/` 作历史参考，npm 包不打包这部分。

- **v2 exec plan**：`aws_codebase/agent_tasks/exec-plans/2026-04-24-skill-mcp-v2-local.md`
- **v1 exec plan（已 superseded）**：`aws_codebase/agent_tasks/exec-plans/2026-04-24-skill-mcp-channel.md`

## 开发

```bash
npm install
npm run build
npm test            # vitest 全套
node dist/index.js status  # 手动冒烟
```

冒烟 install / uninstall（用隔离 HOME）：

```bash
HOME=/tmp/a2h-test-home CLAUDECODE=1 node dist/index.js install --no-login
HOME=/tmp/a2h-test-home CLAUDECODE=1 node dist/index.js status
HOME=/tmp/a2h-test-home CLAUDECODE=1 node dist/index.js uninstall
```

## 发布

打 tag `v*` 触发 `.github/workflows/release.yml` 自动 `npm publish --access public`。需要 `NPM_TOKEN` secret。

## 依赖说明

`@a2hmarket/a2h-skill-lite` **不依赖** `@a2hmarket/a2h-mcp`。installer 只是写 config，让 CC 在运行时 `npx` 拉起 MCP server；不需要 import 对端代码。这样 installer 本身很轻，升级 MCP server 也不用同步 bump installer。

## License

MIT
