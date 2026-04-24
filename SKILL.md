---
name: a2h-assistant
description: Use when the user asks to talk to their A2H Market AI assistant, check orders, receive notifications, or invoke A2H tools. On first use, automatically runs an OAuth-style browser authorization flow and writes an MCP server entry into the local agent platform's config.
---

# A2H Assistant (Lite)

Connect to the A2H Market AI assistant at https://a2hmarket.ai.

## Capabilities (after authorization)

- Two-way chat with the A2H AI assistant
- Receive proactive notifications (order status, reminders, task completion)
- Call A2H business tools (create order, fetch history, upload media, ...)

## What you (the agent) should do

### Trigger conditions

The user says something like "open my A2H assistant", "what's the status of my
A2H order", "send this to A2H", "ask A2H", or any natural-language intent that
clearly maps to A2H Market.

### Scenario 1 — credentials missing, authorization needed

**Detect**: run
```bash
test -f ~/.a2h/credentials.json && echo Y || echo N
```
If the answer is `N`:

1. Execute the bootstrap (it is idempotent — if already bound, it exits 0
   immediately):
   ```bash
   bash <(curl -fsSL https://skill.a2hmarket.ai/bootstrap.sh)
   ```
   The script will:
   - Call `POST https://api.a2hmarket.ai/a2hmarket-concierge/mcp/bind/start`
   - Open the verification URL in the user's browser (`open`, `xdg-open`, or
     `wslview`)
   - Poll for up to 5 minutes until the user clicks Authorize
   - Persist the PAT at `~/.a2h/credentials.json` (chmod 600)
   - Merge an `a2h` MCP server entry into the platform's MCP config
     (preserving any other MCP servers already configured)

2. Read the **last line** of the script's stdout:
   - `OK_RESTART <platform> <restart-command>` — ask the user to run
     `<restart-command>` once, then re-trigger this skill
   - `OK_ALREADY_CONFIGURED` — MCP is ready right now; proceed
   - `FAIL <short-reason>` — relay the reason verbatim and stop

3. Do **not** attempt to call any `a2h.*` MCP tool in this same turn — the
   MCP client inside the agent platform has not loaded the new config yet.

### Scenario 2 — credentials present, MCP active

Call MCP tools directly:

- `a2h.send_message` — send a message to the A2H AI assistant on behalf of
  the user
- `a2h.get_conversation_history` — fetch recent assistant / user turns
- `a2h.create_task` — (Phase 2) create a background task

The MCP server will stream `notifications/message` events back over SSE when
the assistant replies or pushes alerts; surface those to the user as they
arrive.

### Scenario 3 — MCP tool call returns 401

Credentials have expired or been revoked.  Run:

```bash
rm -f ~/.a2h/credentials.json
bash <(curl -fsSL https://skill.a2hmarket.ai/bootstrap.sh)
```

Then follow Scenario 1 from step 2.

## Troubleshooting

- **"Browser did not open"** — the bootstrap prints the verification URL
  to stderr; give it to the user to open manually.
- **"I authorized but nothing happened"** — the poll window is 5 minutes.
  If the user took longer, re-run the bootstrap (it will start a new bind
  code).
- **View or revoke tokens** — https://a2hmarket.ai → Me → Tokens
- **Manual MCP config** — if `detect-platform.sh` returns `unknown`, the
  bootstrap will exit with `FAIL unknown-platform`; use `.mcp.json.template`
  as a starting point and fill in the PAT manually.

## How the script stays up to date

`skill.a2hmarket.ai/bootstrap.sh` is served by CloudFront from the
`xemaya/a2h-lite-skill` repo (`scripts/bootstrap.sh`).  Bug fixes land on
the CDN without requiring users to update this SKILL.md.
