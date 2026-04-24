> **⚠️ DEPRECATED — 2026-04-24**
>
> 本 SKILL 已废弃，新方案请使用 [@xemaya/a2h-mcp](https://github.com/xemaya/a2h-mcp) 本地 MCP server。
>
> 详见本仓库 [README.md](./README.md)。

# A2H Assistant — Hermes adapter notes (BETA placeholder)

> **Status:** awaiting the first internal Hermes beta user to fill in the
> real values.  The fields marked TODO below are educated guesses —
> please correct them via PR once you've verified on a real Hermes install.

## Installing the skill

TODO — confirm Hermes's skill registration model (file drop? CLI register?).

```bash
# TODO verify this path
mkdir -p ~/.hermes/skills/a2h-assistant
curl -fsSL https://raw.githubusercontent.com/xemaya/a2h-lite-skill/main/SKILL.md \
  -o ~/.hermes/skills/a2h-assistant/SKILL.md
```

## MCP config path

`platforms/hermes.conf` currently defaults to `~/.hermes/mcp.json`
(placeholder).  Hermes beta users, please confirm the real path and
schema.

## Restart command

TODO — confirm.  Guess: `hermes mcp reload` or similar.

## Platform detection

`scripts/detect-platform.sh` returns `hermes` when either:

- `$HERMES_SESSION` is set (guess)
- `$HOME/.hermes/` directory exists

## Troubleshooting

- Populate this section once we have a verified install.
