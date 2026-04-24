#!/usr/bin/env bash
#
# detect-platform.sh — print the agent platform we're running inside.
#
# Output (one of):
#   claude-code
#   openclaw
#   hermes
#   unknown
#
# Detection strategy: probe environment variables the runtime injects into
# a skill's shell, then fall back to well-known config paths.  These
# heuristics are best-effort; beta users will calibrate them against real
# runtimes and open PRs as needed.
#
set -euo pipefail

# Claude Code injects CLAUDECODE=1 and CLAUDE_CODE_ENTRYPOINT=<bin> into
# every subshell spawned by a tool call.
if [ -n "${CLAUDECODE:-}" ] || [ -n "${CLAUDE_CODE_ENTRYPOINT:-}" ]; then
    echo "claude-code"
    exit 0
fi

# Openclaw (beta guess — please correct)
if [ -n "${OPENCLAW_RUNTIME:-}" ] || [ -f "$HOME/.openclaw/config.json" ]; then
    echo "openclaw"
    exit 0
fi

# Hermes (beta guess — please correct)
if [ -n "${HERMES_SESSION:-}" ] || [ -d "$HOME/.hermes" ]; then
    echo "hermes"
    exit 0
fi

echo "unknown"
