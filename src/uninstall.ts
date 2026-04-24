import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { detectPlatform, resolveConfig } from "./detect-platform.js";
import {
  readMcpConfig,
  removeServer,
  writeMcpConfig,
} from "./mcp-config.js";
import { SKILL_NAME } from "./skill-template.js";

/**
 * Best-effort uninstall. Leaves credentials at ~/.a2h/credentials.json in
 * place so the user can re-install without re-authorizing.
 */
export function uninstall(): void {
  const platform = detectPlatform();
  const cfg = resolveConfig(platform);
  if (platform === "unknown") {
    process.stderr.write("Cannot detect platform. Nothing to uninstall.\n");
    process.exit(1);
  }

  const existing = readMcpConfig(cfg.mcpConfigPath);
  const next = removeServer(existing, "a2h");
  writeMcpConfig(cfg.mcpConfigPath, next);
  process.stderr.write(`Removed a2h from ${cfg.mcpConfigPath}\n`);

  if (cfg.skillsDir) {
    const skillPath = join(cfg.skillsDir, `${SKILL_NAME}.md`);
    if (existsSync(skillPath)) {
      unlinkSync(skillPath);
      process.stderr.write(`Removed ${skillPath}\n`);
    }
  }

  process.stderr.write(
    `\nNote: ~/.a2h/credentials.json is NOT deleted. Run "rm ~/.a2h/credentials.json" manually for a full clean.\n`,
  );
}
