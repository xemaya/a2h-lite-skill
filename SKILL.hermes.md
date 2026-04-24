> **📦 v1 HISTORICAL REFERENCE — 2026-04-24**
>
> 本 SKILL 文件是 v1 bash bootstrap 方案的产物，作为历史参考保留。
>
> v2 起的 skill 定义由 `@a2hmarket/a2h-skill-lite` 的 installer 在用户本地动态生成（见 `src/skill-template.ts`），而不是仓库里的静态文件。

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
