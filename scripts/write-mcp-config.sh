#!/usr/bin/env bash
#
# write-mcp-config.sh — check for, or write, the "a2h" MCP server entry
# inside the current agent platform's MCP config file.
#
# Usage:
#   write-mcp-config.sh check
#       Exit 0 if the a2h server is already configured; exit 1 otherwise.
#       Uses detect-platform.sh to pick the right platforms/*.conf.
#
#   write-mcp-config.sh write <platform> <token>
#       Merge an a2h MCP server entry into the platform's config file,
#       preserving any other entries.  Creates parent dirs / the file
#       itself as needed.
#
# Dependencies: jq preferred.  If jq is missing, falls back to a
# python3-based JSON merger (Python 3.6+).
#
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PLATFORMS_DIR="${SCRIPT_DIR}/../platforms"

# --- helpers ----------------------------------------------------------------

have_jq() { command -v jq >/dev/null 2>&1; }
have_python3() { command -v python3 >/dev/null 2>&1; }

# check_has_server <config-file> <server-name>
# exit 0 if .mcpServers[<server-name>] exists; 1 otherwise.
check_has_server() {
    local cfg="$1" name="$2"
    [ -f "$cfg" ] || return 1
    if have_jq; then
        jq -e --arg n "$name" '.mcpServers[$n] // empty' "$cfg" >/dev/null 2>&1
    elif have_python3; then
        python3 - "$cfg" "$name" <<'PY' >/dev/null 2>&1
import json, sys
with open(sys.argv[1], "r") as f:
    d = json.load(f)
srv = (d.get("mcpServers") or {}).get(sys.argv[2])
sys.exit(0 if srv else 1)
PY
    else
        echo "write-mcp-config.sh: need jq or python3 installed" >&2
        return 2
    fi
}

# merge_server <config-file> <server-name> <url> <token>
# Writes (or overwrites) .mcpServers[<name>] preserving every other field.
merge_server() {
    local cfg="$1" name="$2" url="$3" tok="$4"
    local tmp
    tmp="$(mktemp)"
    if have_jq; then
        jq --arg n "$name" --arg u "$url" --arg t "$tok" \
            '(.mcpServers //= {}) | .mcpServers[$n] = {
                transport: "sse",
                url: $u,
                headers: { "Authorization": ("Bearer " + $t) }
            }' "$cfg" > "$tmp"
    elif have_python3; then
        python3 - "$cfg" "$name" "$url" "$tok" "$tmp" <<'PY'
import json, sys
cfg, name, url, tok, tmp = sys.argv[1:6]
with open(cfg, "r") as f:
    d = json.load(f)
d.setdefault("mcpServers", {})
d["mcpServers"][name] = {
    "transport": "sse",
    "url": url,
    "headers": {"Authorization": "Bearer " + tok},
}
with open(tmp, "w") as f:
    json.dump(d, f, indent=2)
    f.write("\n")
PY
    else
        echo "write-mcp-config.sh: need jq or python3 installed" >&2
        rm -f "$tmp"
        return 2
    fi
    mv "$tmp" "$cfg"
}

# --- modes ------------------------------------------------------------------

mode="${1:-check}"

case "$mode" in
    check)
        plat="$("$SCRIPT_DIR/detect-platform.sh")"
        [ "$plat" = "unknown" ] && exit 1
        # shellcheck disable=SC1090
        source "${PLATFORMS_DIR}/${plat}.conf"
        [ -f "$MCP_CONFIG_PATH" ] || exit 1
        check_has_server "$MCP_CONFIG_PATH" "$MCP_SERVER_NAME"
        ;;
    write)
        plat="${2:-}"
        tok="${3:-}"
        if [ -z "$plat" ] || [ -z "$tok" ]; then
            echo "usage: write-mcp-config.sh write <platform> <token>" >&2
            exit 2
        fi
        if [ ! -f "${PLATFORMS_DIR}/${plat}.conf" ]; then
            echo "write-mcp-config.sh: no platform config ${plat}.conf" >&2
            exit 2
        fi
        # shellcheck disable=SC1090
        source "${PLATFORMS_DIR}/${plat}.conf"
        mkdir -p "$(dirname "$MCP_CONFIG_PATH")"
        if [ ! -f "$MCP_CONFIG_PATH" ]; then
            echo '{"mcpServers":{}}' > "$MCP_CONFIG_PATH"
        fi
        merge_server "$MCP_CONFIG_PATH" "$MCP_SERVER_NAME" "$MCP_URL" "$tok"
        ;;
    *)
        echo "usage: write-mcp-config.sh {check | write <platform> <token>}" >&2
        exit 2
        ;;
esac
