import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { detectPlatform, resolveConfig } from "./detect-platform.js";
import { hasServer, readMcpConfig } from "./mcp-config.js";
import { SKILL_NAME } from "./skill-template.js";

/** Print a quick diagnostic snapshot of the local install to stderr. */
export function status(): void {
  const platform = detectPlatform();
  const cfg = resolveConfig(platform);

  process.stderr.write(`Platform: ${platform}\n`);
  process.stderr.write(
    `MCP config path: ${cfg.mcpConfigPath || "(unknown)"}\n`,
  );

  if (cfg.mcpConfigPath) {
    try {
      const mcp = readMcpConfig(cfg.mcpConfigPath);
      process.stderr.write(
        `MCP server "a2h" configured: ${hasServer(mcp, "a2h") ? "yes" : "no"}\n`,
      );
    } catch (e) {
      process.stderr.write(
        `MCP config unreadable: ${(e as Error).message}\n`,
      );
    }
  }

  if (cfg.skillsDir) {
    const skillPath = join(cfg.skillsDir, `${SKILL_NAME}.md`);
    process.stderr.write(
      `Skill file: ${existsSync(skillPath) ? `yes (${skillPath})` : "no (not installed)"}\n`,
    );
  }

  const credPath = process.env.A2H_HOME
    ? join(process.env.A2H_HOME, "credentials.json")
    : join(homedir(), ".a2h", "credentials.json");
  if (existsSync(credPath)) {
    try {
      const creds = JSON.parse(readFileSync(credPath, "utf-8"));
      process.stderr.write(
        `Credentials: yes (${creds.tokenName ?? "(anonymous)"} agentId=${creds.agentId ?? "?"})\n`,
      );
    } catch {
      process.stderr.write(`Credentials: file exists but is corrupted\n`);
    }
  } else {
    process.stderr.write(
      `Credentials: not logged in. Run: npx -y @a2hmarket/a2h-mcp login\n`,
    );
  }
}
