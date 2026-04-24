# a2h-lite-skill

A portable **agent skill** that connects Claude Code / Openclaw / Hermes (and any other agent
runtime able to execute `bash`) to the [A2H Market](https://a2hmarket.ai) AI assistant over MCP
(Model Context Protocol).

This is the **Phase 1 "lite" version**: the skill ships a shell bootstrap
(`scripts/bootstrap.sh`) that performs an OAuth-style device flow, stores a
Personal Access Token (PAT), and writes the MCP server config into the current
agent platform's config file.

## Design intent — why bash bootstrap, not OAuth 2.1 auto-discovery

MCP 2025-06-18 defines an OAuth 2.1 + PKCE auto-discovery flow (the server
returns 401 + `WWW-Authenticate`, the MCP client kicks off a PKCE flow
transparently).  CC supports it today, **Openclaw / Hermes coverage is
inconsistent**, and we want a single onboarding path that works on all three.

The common lowest denominator every modern agent runtime already provides is
"execute `bash`".  So we chose:

1. `SKILL.md` instructs the agent: if `~/.a2h/credentials.json` is missing,
   run `bash <(curl -fsSL https://skill.a2hmarket.ai/bootstrap.sh)`.
2. `bootstrap.sh` calls `POST /mcp/bind/start`, opens a browser, polls for
   READY, persists the PAT at `~/.a2h/credentials.json`, and writes the MCP
   server entry into the platform-specific config (`~/.claude.json`,
   `~/.openclaw/mcp.json`, ...).
3. The script's final line is `OK_RESTART <platform> <restart-command>`; the
   agent reads that line and asks the user to run it once.  Subsequent skill
   invocations go straight to MCP.

When Openclaw / Hermes MCP clients catch up on 2025-06-18 OAuth auto-discovery,
Phase 2 can drop the bootstrap on those platforms without breaking PAT
storage — the server side (`a2hmarket-concierge` MCP endpoint + findu-user
`agent_api_token`) stays unchanged.

## Why xemaya (and not keman-ai)

Product shape is still in flux (Claude Code today, Openclaw/Hermes next,
possibly Cursor/others later).  We incubate in `xemaya/` for ~2 weeks, and
once Phase 1 ships and a second platform is integrated, transfer the repo
via `gh repo transfer xemaya/a2h-lite-skill keman-ai/a2h-skill`.  No code
changes required.

## Layout

```
a2h-lite-skill/
├── README.md                       # this file
├── SKILL.md                        # generic skill spec (load this in any agent)
├── SKILL.claude-code.md            # Claude Code-specific notes
├── SKILL.openclaw.md               # Openclaw-specific notes (beta placeholder)
├── SKILL.hermes.md                 # Hermes-specific notes (beta placeholder)
├── .mcp.json.template              # manual fallback for advanced users
├── scripts/
│   ├── bootstrap.sh                # core entrypoint (device flow + write MCP config)
│   ├── detect-platform.sh          # returns claude-code | openclaw | hermes | unknown
│   ├── write-mcp-config.sh         # check / write MCP server entry (jq-merge, idempotent)
│   └── test-connection.sh          # GET /mcp/health with the stored PAT
├── platforms/
│   ├── claude-code.conf
│   ├── openclaw.conf               # TODO: beta-user calibration
│   └── hermes.conf                 # TODO: beta-user calibration
└── .github/workflows/
    └── deploy-skill-scripts.yml    # push main → S3 + CloudFront invalidation
```

## Try it locally (without real backend)

```bash
# syntax only
bash -n scripts/bootstrap.sh
bash -n scripts/detect-platform.sh
bash -n scripts/write-mcp-config.sh

# detect the current platform
bash scripts/detect-platform.sh

# exercise write-mcp-config against /tmp (won't touch your real ~/.claude.json)
mkdir -p /tmp/a2h-test
MCP_CONFIG_PATH=/tmp/a2h-test/fake-claude.json \
  bash -c 'source platforms/claude-code.conf;
           MCP_CONFIG_PATH=/tmp/a2h-test/fake-claude.json;
           echo "{\"mcpServers\":{}}" > $MCP_CONFIG_PATH;
           bash scripts/write-mcp-config.sh write claude-code a2h_pat_test_abc'
cat /tmp/a2h-test/fake-claude.json

# bootstrap against a non-existent API (fails fast, does not hang)
A2H_API_BASE="http://localhost:12345" timeout 10 bash scripts/bootstrap.sh
```

## Contributing — adding a new agent platform

1. Add a new `platforms/<name>.conf` with `MCP_CONFIG_PATH`, `MCP_SERVER_NAME`,
   `MCP_URL`, `RESTART_CMD`.
2. Add a detection branch in `scripts/detect-platform.sh`
   (environment variable or config path signature).
3. Copy `SKILL.claude-code.md` to `SKILL.<name>.md` and fill in the platform's
   specific load path, restart semantics, and troubleshooting entries.
4. Run `bash -n` on every script, exercise
   `scripts/write-mcp-config.sh write <name> a2h_pat_test_abc` against a
   `$TMPDIR` config, and open a PR.

## Dependencies

- `curl` (every modern OS ships this)
- `bash` (4.x or 5.x)
- `jq` — optional; `bootstrap.sh` falls back to `python3 -c` if `jq` is absent
- nothing else — no `pip install`, no `npm install`, no language runtime

## Related

- Design plan: `aws_codebase/agent_tasks/exec-plans/2026-04-24-skill-mcp-channel.md`
  (internal — Task 10)
- Backend MCP endpoint: `App/a2hmarket-concierge/...` (internal)
- PAT issuing / verifying: `App/findu-user/...` (internal)

## License

MIT — see `LICENSE`.
