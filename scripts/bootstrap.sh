#!/usr/bin/env bash
#
# bootstrap.sh — A2H Market agent skill onboarding.
#
# Flow:
#   1. If ~/.a2h/credentials.json exists AND the platform's MCP config
#      already contains the a2h server entry → print OK_ALREADY_CONFIGURED
#      and exit 0 (idempotent).
#   2. Otherwise, run a device-authorization-grant flow against
#      ${A2H_API_BASE}/mcp/bind/{start,poll}:
#        - open the verification URL in the user's browser
#        - poll up to 5 minutes for status=READY
#        - store the PAT in ~/.a2h/credentials.json (chmod 600)
#   3. Detect the current agent platform and merge an "a2h" entry into
#      its MCP config (preserving other servers).
#   4. Print `OK_RESTART <platform> <restart-command>` as the final line.
#
# On failure, print `FAIL <short-reason>` on stdout, details to stderr,
# and exit non-zero.
#
# Environment overrides:
#   A2H_API_BASE   — defaults to https://api.a2hmarket.ai/a2hmarket-concierge
#
set -euo pipefail

# ---------------------------------------------------------------------------
# locate sibling scripts robustly: this script may be invoked via
# `bash <(curl ...)` (BASH_SOURCE is /dev/fd/NN in that case) OR as a
# plain file.  We prefer BASH_SOURCE when it points to a real file;
# otherwise we fall back to the directory the script lives in as cloned.
# When served via CDN+curl, the sibling scripts are also fetched at the
# same S3 prefix, so if BASH_SOURCE is not a real file the caller is
# expected to have cloned the repo (which is how the SKILL.md workflow
# runs it).
# ---------------------------------------------------------------------------

if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
else
    SCRIPT_DIR="$( pwd )/scripts"
fi

API="${A2H_API_BASE:-https://api.a2hmarket.ai/a2hmarket-concierge}"
CRED="${A2H_CREDENTIALS:-$HOME/.a2h/credentials.json}"
UA="a2h-skill-bootstrap/1.0"
POLL_INTERVAL="${A2H_POLL_INTERVAL:-5}"
POLL_MAX_ATTEMPTS="${A2H_POLL_MAX_ATTEMPTS:-60}"

# ---------------------------------------------------------------------------
# jq / python3 fallback.  Many macOS + Linux minimal installs ship without
# jq; python3 is practically universal.  We provide a `jget <json> <path>`
# helper that takes a JSON string on stdin and a simple dotted path like
# `.data.token` and prints the scalar value.
# ---------------------------------------------------------------------------

have_jq() { command -v jq >/dev/null 2>&1; }
have_python3() { command -v python3 >/dev/null 2>&1; }

jget() {
    # usage: echo "$json" | jget .data.token
    # Reads JSON from stdin; prints the scalar at the dotted path.
    # NOTE: must not use heredoc for the Python source — that would
    # shadow stdin.  We pass the source via -c so sys.stdin is the pipe.
    local path="$1"
    if have_jq; then
        jq -r "$path"
    elif have_python3; then
        python3 -c '
import json, sys
path = sys.argv[1].lstrip(".")
data = json.load(sys.stdin)
if path:
    for part in path.split("."):
        if part.isdigit() and isinstance(data, list):
            data = data[int(part)]
        else:
            data = (data or {}).get(part) if isinstance(data, dict) else None
if data is None:
    print("")
elif isinstance(data, (dict, list)):
    print(json.dumps(data))
else:
    print(data)
' "$path"
    else
        echo "bootstrap.sh: need jq or python3 installed" >&2
        return 2
    fi
}

fail() {
    local reason="$1"
    shift || true
    [ "$#" -gt 0 ] && echo "$@" >&2
    echo "FAIL $reason"
    exit 1
}

# ---------------------------------------------------------------------------
# Step 1 — idempotent fast path
# ---------------------------------------------------------------------------

if [ -f "$CRED" ]; then
    if bash "$SCRIPT_DIR/write-mcp-config.sh" check >/dev/null 2>&1; then
        echo "OK_ALREADY_CONFIGURED"
        exit 0
    fi
    # credentials exist but MCP config missing / unknown platform — we'll
    # write it below (re-using the stored token).
fi

# ---------------------------------------------------------------------------
# Step 2 — device flow (only if credentials absent)
# ---------------------------------------------------------------------------

if [ ! -f "$CRED" ]; then
    echo "A2H: starting browser authorization..." >&2

    resp="$(curl -fsS -A "$UA" -X POST "$API/mcp/bind/start" 2>&1)" \
        || fail "bind-start-network" "curl POST $API/mcp/bind/start failed: $resp"

    code="$(printf '%s' "$resp" | jget .data.code || true)"
    verify="$(printf '%s' "$resp" | jget .data.verifyUrl || true)"
    if [ -z "$code" ] || [ -z "$verify" ] || [ "$code" = "null" ] || [ "$verify" = "null" ]; then
        fail "bind-start-bad-response" "unexpected response body: $resp"
    fi

    host="$(hostname -s 2>/dev/null || hostname 2>/dev/null || echo skill-client)"
    # URL-encode the hostname minimally for inclusion as a query param
    host_enc="$(printf '%s' "$host" | sed 's/[^A-Za-z0-9._-]/-/g')"
    if printf '%s' "$verify" | grep -q '?'; then
        full="${verify}&hostname=${host_enc}"
    else
        full="${verify}?hostname=${host_enc}"
    fi

    {
        printf "\n==========================================\n"
        printf "  Open this URL in your browser to authorize:\n"
        printf "  %s\n" "$full"
        printf "==========================================\n\n"
    } >&2

    # Best-effort browser open.  All failures are silent — the URL is
    # already printed above so the user can copy-paste.
    if command -v open >/dev/null 2>&1; then
        open "$full" >/dev/null 2>&1 || true
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$full" >/dev/null 2>&1 || true
    elif command -v wslview >/dev/null 2>&1; then
        wslview "$full" >/dev/null 2>&1 || true
    fi

    st="PENDING"
    tok=""
    agent_id=""
    token_name=""
    attempt=0
    while [ "$attempt" -lt "$POLL_MAX_ATTEMPTS" ]; do
        attempt=$((attempt + 1))
        sleep "$POLL_INTERVAL"
        pr="$(curl -fsS -A "$UA" "$API/mcp/bind/poll?code=$code" 2>&1)" || {
            # transient network blip — keep polling
            echo "A2H: poll attempt $attempt: network error, retrying" >&2
            continue
        }
        st="$(printf '%s' "$pr" | jget .data.status || echo UNKNOWN)"
        case "$st" in
            READY)
                tok="$(printf '%s' "$pr" | jget .data.token || true)"
                agent_id="$(printf '%s' "$pr" | jget .data.agentId || true)"
                token_name="$(printf '%s' "$pr" | jget .data.tokenName || true)"
                if [ -z "$tok" ] || [ "$tok" = "null" ]; then
                    fail "bind-ready-no-token" "poll returned READY without a token: $pr"
                fi
                break
                ;;
            EXPIRED)
                fail "bind-expired" "device code expired before user authorized"
                ;;
            PENDING)
                : # keep polling
                ;;
            *)
                echo "A2H: poll attempt $attempt: unexpected status '$st' (body: $pr), retrying" >&2
                ;;
        esac
    done

    if [ "$st" != "READY" ]; then
        fail "bind-timeout" "no READY after $POLL_MAX_ATTEMPTS * $POLL_INTERVAL s"
    fi

    mkdir -p "$(dirname "$CRED")"
    umask 077
    cat > "$CRED" <<EOF
{
  "token": "$tok",
  "agentId": "$agent_id",
  "tokenName": "$token_name",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    chmod 600 "$CRED"
    echo "A2H: credentials stored at $CRED" >&2
fi

# ---------------------------------------------------------------------------
# Step 3 — write MCP config for the detected platform
# ---------------------------------------------------------------------------

TOK="$(cat "$CRED" | jget .token || true)"
if [ -z "$TOK" ] || [ "$TOK" = "null" ]; then
    fail "credentials-corrupt" "could not read token from $CRED"
fi

PLATFORM="$(bash "$SCRIPT_DIR/detect-platform.sh")"
if [ "$PLATFORM" = "unknown" ]; then
    fail "unknown-platform" "platform detection returned 'unknown'; edit .mcp.json manually using .mcp.json.template"
fi

bash "$SCRIPT_DIR/write-mcp-config.sh" write "$PLATFORM" "$TOK" \
    || fail "write-mcp-config" "write-mcp-config.sh exited non-zero"

# ---------------------------------------------------------------------------
# Step 4 — emit the OK_RESTART summary line
# ---------------------------------------------------------------------------

PLATFORMS_DIR="$SCRIPT_DIR/../platforms"
conf="${PLATFORMS_DIR}/${PLATFORM}.conf"
if [ ! -f "$conf" ]; then
    fail "missing-platform-conf" "expected $conf"
fi
restart_cmd="$(grep -E '^[[:space:]]*RESTART_CMD=' "$conf" | head -1 | sed -E 's/^[[:space:]]*RESTART_CMD=//; s/^"//; s/"$//')"
if [ -z "$restart_cmd" ]; then
    fail "missing-restart-cmd" "no RESTART_CMD= in $conf"
fi

echo "OK_RESTART $PLATFORM $restart_cmd"
