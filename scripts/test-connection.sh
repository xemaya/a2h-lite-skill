#!/usr/bin/env bash
#
# test-connection.sh — sanity-check the stored PAT against the MCP
# backend's health endpoint.  Prints a human line + exits with:
#   0  — health check returned 200
#   1  — 401 (token invalid / revoked — re-run bootstrap.sh)
#   2  — any other HTTP status or network failure
#
# Environment overrides:
#   A2H_API_BASE       — default https://api.a2hmarket.ai/a2hmarket-concierge
#   A2H_CREDENTIALS    — default $HOME/.a2h/credentials.json
#
set -euo pipefail

API="${A2H_API_BASE:-https://api.a2hmarket.ai/a2hmarket-concierge}"
CRED="${A2H_CREDENTIALS:-$HOME/.a2h/credentials.json}"

if [ ! -f "$CRED" ]; then
    echo "test-connection.sh: no credentials at $CRED; run bootstrap.sh" >&2
    exit 2
fi

# Parse the token without requiring jq (same fallback as bootstrap.sh).
if command -v jq >/dev/null 2>&1; then
    TOK="$(jq -r .token < "$CRED")"
elif command -v python3 >/dev/null 2>&1; then
    TOK="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("token",""))' "$CRED")"
else
    echo "test-connection.sh: need jq or python3 installed" >&2
    exit 2
fi

if [ -z "$TOK" ] || [ "$TOK" = "null" ]; then
    echo "test-connection.sh: credentials file has no token" >&2
    exit 2
fi

status="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOK" \
    "$API/mcp/health" || echo 000)"

case "$status" in
    200)
        echo "OK $status"
        exit 0
        ;;
    401)
        echo "UNAUTHORIZED $status (run: rm -f $CRED && bash scripts/bootstrap.sh)"
        exit 1
        ;;
    000)
        echo "NETWORK_ERROR (could not reach $API/mcp/health)"
        exit 2
        ;;
    *)
        echo "HTTP_ERROR $status"
        exit 2
        ;;
esac
