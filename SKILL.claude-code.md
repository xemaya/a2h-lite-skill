> **📦 v1 HISTORICAL REFERENCE — 2026-04-24**
>
> 本 SKILL 文件是 v1 bash bootstrap 方案的产物，作为历史参考保留。
>
> v2 起的 skill 定义由 `@a2hmarket/a2h-skill-lite` 的 installer 在用户本地动态生成（见 `src/skill-template.ts`），而不是仓库里的静态文件。

# A2H Assistant — Claude Code adapter notes

This document supplements the generic `SKILL.md` with Claude Code-specific
details.

## Installing the skill

Claude Code looks for skills in `~/.claude/skills/<skill-name>/SKILL.md`.

```bash
mkdir -p ~/.claude/skills/a2h-assistant
curl -fsSL https://raw.githubusercontent.com/xemaya/a2h-lite-skill/main/SKILL.md \
  -o ~/.claude/skills/a2h-assistant/SKILL.md
```

Then restart Claude Code (or run `/skills list` to confirm it appears).

## MCP config path

Modern Claude Code (>= 2026-01) writes MCP server entries into
`~/.claude.json` under the top-level `mcpServers` key.  The script uses
`~/.claude.json` by default.

Older Claude Code versions use `~/.claude/mcp_servers.json`.  If you are
on an older CLI, edit `platforms/claude-code.conf` locally to override
`MCP_CONFIG_PATH` before running the bootstrap, e.g.:

```bash
export MCP_CONFIG_PATH="$HOME/.claude/mcp_servers.json"
bash <(curl -fsSL https://skill.a2hmarket.ai/bootstrap.sh)
```

## Restart command

After the bootstrap finishes, run:

```bash
claude mcp restart a2h
```

That re-reads `~/.claude.json`, establishes the SSE connection to
`https://api.a2hmarket.ai/a2hmarket-concierge/mcp/sse`, and makes the
`a2h.*` tools available.

## Platform detection

`scripts/detect-platform.sh` returns `claude-code` when either
`$CLAUDECODE` or `$CLAUDE_CODE_ENTRYPOINT` is set in the environment —
both are injected by the Claude Code runtime when the skill is invoked.

## Troubleshooting

- **`claude mcp list` does not show `a2h`** — check `~/.claude.json`
  contains `.mcpServers.a2h` (`jq '.mcpServers.a2h' ~/.claude.json`).
  If missing, re-run the bootstrap.
- **SSE connection drops immediately** — likely PAT rejected.  Inspect
  the log at `~/.claude/logs/mcp-a2h.log`; a 401 means run Scenario 3.
- **"Unknown MCP transport: sse"** — upgrade Claude Code; SSE transport
  support landed in 2025-09.
