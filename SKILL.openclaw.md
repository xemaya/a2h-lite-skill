> **⚠️ DEPRECATED — 2026-04-24**
>
> 本 SKILL 已废弃，新方案请使用 [@xemaya/a2h-mcp](https://github.com/xemaya/a2h-mcp) 本地 MCP server。
>
> 详见本仓库 [README.md](./README.md)。

# A2H Assistant — Openclaw adapter notes (BETA placeholder)

> **Status:** awaiting the first internal Openclaw beta user to fill in the
> real values.  The fields marked TODO below are educated guesses — please
> correct them via PR once you've verified on a real Openclaw install.

## Installing the skill

TODO — confirm Openclaw's skills directory layout.  Likely
`~/.openclaw/skills/<skill-name>/SKILL.md` by convention.

```bash
# TODO verify this path
mkdir -p ~/.openclaw/skills/a2h-assistant
curl -fsSL https://raw.githubusercontent.com/xemaya/a2h-lite-skill/main/SKILL.md \
  -o ~/.openclaw/skills/a2h-assistant/SKILL.md
```

## MCP config path

`platforms/openclaw.conf` currently defaults to `~/.openclaw/mcp.json`.
Openclaw beta users, please confirm:

- Is the path `~/.openclaw/mcp.json`, `~/.openclaw/config.json` (merged),
  or something else?
- What is the top-level key for MCP servers?  (`mcpServers`?
  `servers`? `mcp.servers`?)

If Openclaw uses a different schema than Claude Code, we may need to teach
`scripts/write-mcp-config.sh` a new branch instead of the generic
`.mcpServers[name] = {...}` merge.

## Restart command

TODO — confirm.  Guess: `openclaw mcp reload` or restart the Openclaw
runtime entirely.

## Platform detection

`scripts/detect-platform.sh` returns `openclaw` when either:

- `$OPENCLAW_RUNTIME` is set (guess — confirm on a real install)
- `$HOME/.openclaw/config.json` exists

Please open a PR with the real environment variable Openclaw sets when
launching a skill.

## Troubleshooting

- Once we have a confirmed install, populate this section with the
  analogues of the Claude Code entries (how to inspect the MCP log, how
  to verify the `a2h` entry is picked up, how to force a reload).
