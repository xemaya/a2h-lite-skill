import { existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { detectPlatform, resolveConfig } from "./detect-platform.js";
import {
  hasServer,
  readMcpConfig,
  removeServer,
  writeMcpConfig,
} from "./mcp-config.js";
import { SKILL_NAME } from "./skill-template.js";

/**
 * Best-effort uninstall. Leaves credentials at $A2H_HOME/credentials.json
 * (default `~/.a2h/credentials.json`) in place so the user can re-install
 * without re-authorizing.
 */
export function uninstall(): void {
  const platform = detectPlatform();
  const cfg = resolveConfig(platform);
  if (platform === "unknown") {
    process.stderr.write("Cannot detect platform. Nothing to uninstall.\n");
    process.exit(1);
  }

  const existing = readMcpConfig(cfg.mcpConfigPath);
  if (hasServer(existing, "a2h")) {
    const next = removeServer(existing, "a2h");
    writeMcpConfig(cfg.mcpConfigPath, next);
    process.stderr.write(`Removed a2h from ${cfg.mcpConfigPath}\n`);
  } else {
    process.stderr.write(
      `(a2h not configured in ${cfg.mcpConfigPath}, nothing to remove)\n`,
    );
  }

  if (cfg.skillsDir) {
    const skillPath = join(cfg.skillsDir, `${SKILL_NAME}.md`);
    if (existsSync(skillPath)) {
      unlinkSync(skillPath);
      process.stderr.write(`Removed ${skillPath}\n`);
    }
  }

  const credDir = process.env.A2H_HOME || join(homedir(), ".a2h");
  const credPath = join(credDir, "credentials.json");
  process.stderr.write(
    `\nNote: ${credPath} is NOT deleted. Run "rm ${credPath}" manually for a full clean.\n`,
  );
}
