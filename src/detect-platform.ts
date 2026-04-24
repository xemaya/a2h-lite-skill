import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type Platform = "claude-code" | "openclaw" | "hermes" | "unknown";

export interface PlatformConfig {
  platform: Platform;
  /** Absolute path of the MCP config file (empty for unknown platforms). */
  mcpConfigPath: string;
  /** Absolute path of the skills directory, or null if the platform has no CC-style skill format. */
  skillsDir: string | null;
  /** Human-friendly hint shown after install/uninstall. */
  restartCommand: string;
}

/**
 * Sniff the surrounding agent runtime. Env vars take priority over on-disk
 * markers, so CI and tests can force a platform by setting e.g. CLAUDECODE=1.
 */
export function detectPlatform(): Platform {
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT) {
    return "claude-code";
  }
  if (process.env.OPENCLAW_RUNTIME) {
    return "openclaw";
  }
  if (process.env.HERMES_SESSION) {
    return "hermes";
  }

  const home = homedir();
  if (existsSync(join(home, ".openclaw", "config.json"))) {
    return "openclaw";
  }
  if (existsSync(join(home, ".hermes"))) {
    return "hermes";
  }
  if (existsSync(join(home, ".claude.json"))) {
    return "claude-code";
  }
  return "unknown";
}

/**
 * Return platform-specific paths. The Openclaw and Hermes entries are best
 * guesses — they'll be confirmed against real installs during the internal
 * beta and corrected here.
 */
export function resolveConfig(platform: Platform): PlatformConfig {
  const home = homedir();
  switch (platform) {
    case "claude-code":
      return {
        platform,
        mcpConfigPath: join(home, ".claude.json"),
        skillsDir: join(home, ".claude", "skills"),
        restartCommand:
          "claude mcp restart a2h (or fully restart Claude Code)",
      };
    case "openclaw":
      // TODO(beta): confirm real path + skill layout with maintainer
      return {
        platform,
        mcpConfigPath: join(home, ".openclaw", "mcp.json"),
        skillsDir: null,
        restartCommand: "openclaw mcp reload (verify with maintainer)",
      };
    case "hermes":
      // TODO(beta): confirm real path + skill layout with maintainer
      return {
        platform,
        mcpConfigPath: join(home, ".hermes", "mcp.json"),
        skillsDir: null,
        restartCommand: "hermes reload (verify with maintainer)",
      };
    default:
      return {
        platform: "unknown",
        mcpConfigPath: "",
        skillsDir: null,
        restartCommand: "",
      };
  }
}
