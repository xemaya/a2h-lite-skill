import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { detectPlatform, resolveConfig } from "./detect-platform.js";
import { hasServer, readMcpConfig } from "./mcp-config.js";
import { SKILL_NAME } from "./skill-template.js";

/**
 * Print a diagnostic snapshot of the local install. Writes to stdout (not
 * stderr) so callers can pipe the output to `tee` / redirect to a file.
 */
export function status(): void {
  const platform = detectPlatform();
  const cfg = resolveConfig(platform);

  console.log(`Platform: ${platform}`);
  console.log(`MCP config path: ${cfg.mcpConfigPath || "(unknown)"}`);

  if (cfg.mcpConfigPath) {
    try {
      const mcp = readMcpConfig(cfg.mcpConfigPath);
      console.log(
        `MCP server "a2h" configured: ${hasServer(mcp, "a2h") ? "yes" : "no"}`,
      );
    } catch (e) {
      console.log(`MCP config unreadable: ${(e as Error).message}`);
    }
  }

  if (cfg.skillsDir) {
    const skillPath = join(cfg.skillsDir, `${SKILL_NAME}.md`);
    console.log(
      `Skill file: ${existsSync(skillPath) ? `yes (${skillPath})` : "no (not installed)"}`,
    );
  }

  const credPath = process.env.A2H_HOME
    ? join(process.env.A2H_HOME, "credentials.json")
    : join(homedir(), ".a2h", "credentials.json");
  if (existsSync(credPath)) {
    try {
      const creds = JSON.parse(readFileSync(credPath, "utf-8"));
      console.log(
        `Credentials: yes (${creds.tokenName ?? "(anonymous)"} agentId=${creds.agentId ?? "?"})`,
      );
    } catch {
      console.log(`Credentials: file exists but is corrupted`);
    }
  } else {
    console.log(
      `Credentials: not logged in. Run: npx -y -p @a2hmarket/a2h-mcp a2h-mcp-login`,
    );
  }
}
