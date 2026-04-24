import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { detectPlatform, resolveConfig } from "./detect-platform.js";
import {
  hasServer,
  readMcpConfig,
  upsertServer,
  writeMcpConfig,
  type McpServerEntry,
} from "./mcp-config.js";
import { SKILL_MARKDOWN, SKILL_NAME } from "./skill-template.js";

/** Resolve credentials.json path, honoring A2H_HOME override. */
function credentialsPath(): string {
  const base = process.env.A2H_HOME || join(homedir(), ".a2h");
  return join(base, "credentials.json");
}

/** True if a credentials file already exists (we don't validate contents). */
function hasCredentials(): boolean {
  return existsSync(credentialsPath());
}

export interface InstallOptions {
  /** When false, skip the `a2h-mcp login` child process. Default: true. */
  login?: boolean;
  /** Optional override for the backend base URL (e.g. staging). */
  apiBase?: string;
}

/**
 * Idempotent installer. Writes the a2h MCP server into the platform's config
 * (preserving other servers), drops SKILL.md if the platform supports it,
 * then optionally kicks off the device-flow login.
 */
export async function install(opts: InstallOptions = {}): Promise<void> {
  const platform = detectPlatform();
  const cfg = resolveConfig(platform);

  if (platform === "unknown") {
    process.stderr.write(
      "Could not detect agent platform (CC/Openclaw/Hermes).\n",
    );
    process.stderr.write("Manual install: add to your .mcp.json:\n");
    process.stderr.write(
      JSON.stringify(
        {
          mcpServers: {
            a2h: { command: "npx", args: ["-y", "@a2hmarket/a2h-mcp"] },
          },
        },
        null,
        2,
      ) + "\n",
    );
    process.exit(1);
  }

  process.stderr.write(`Detected platform: ${platform}\n`);
  process.stderr.write(`MCP config: ${cfg.mcpConfigPath}\n`);

  // 1. MCP server config (idempotent, but re-upsert when apiBase changes).
  const existing = readMcpConfig(cfg.mcpConfigPath);
  const existingEntry = existing.mcpServers?.a2h;
  const existingApiBase = existingEntry?.env?.A2H_API_BASE;
  const apiBaseChanged =
    opts.apiBase !== undefined && opts.apiBase !== existingApiBase;

  if (hasServer(existing, "a2h") && !apiBaseChanged) {
    process.stderr.write(`✓ a2h MCP server already configured\n`);
  } else {
    const entry: McpServerEntry = {
      command: "npx",
      args: ["-y", "@a2hmarket/a2h-mcp"],
      ...(opts.apiBase ? { env: { A2H_API_BASE: opts.apiBase } } : {}),
    };
    const next = upsertServer(existing, "a2h", entry);
    writeMcpConfig(cfg.mcpConfigPath, next);
    if (apiBaseChanged && hasServer(existing, "a2h")) {
      process.stderr.write(
        `Updated a2h entry (A2H_API_BASE → ${opts.apiBase})\n`,
      );
    } else {
      process.stderr.write(`Wrote ${cfg.mcpConfigPath}\n`);
    }
  }

  // 2. Skill markdown (CC only for now).
  if (cfg.skillsDir) {
    mkdirSync(cfg.skillsDir, { recursive: true });
    const skillPath = join(cfg.skillsDir, `${SKILL_NAME}.md`);
    writeFileSync(skillPath, SKILL_MARKDOWN);
    process.stderr.write(`Wrote ${skillPath}\n`);
  } else {
    process.stderr.write(
      `(skill.md skipped - platform ${platform} skill format TBD)\n`,
    );
  }

  // 3. Login, independently gated from config presence. The old behaviour
  // skipped login whenever the config already existed, so a user whose first
  // install failed at login would stay logged-out forever on re-runs.
  const doLogin = opts.login !== false;
  process.stderr.write(`\nInstallation complete.\n`);

  if (doLogin) {
    if (hasCredentials()) {
      process.stderr.write(`✓ already logged in (${credentialsPath()})\n`);
    } else {
      process.stderr.write(`\nNext step: starting login flow...\n`);
      try {
        await runLogin(opts.apiBase);
      } catch (e) {
        process.stderr.write(
          `\nLogin failed: ${(e as Error).message}\n` +
            `You can retry manually with:\n` +
            `   npx -y -p @a2hmarket/a2h-mcp a2h-mcp-login\n`,
        );
        throw e;
      }
    }
    process.stderr.write(
      `\nNow restart your agent (${cfg.restartCommand}) to activate the skill.\n`,
    );
  } else {
    process.stderr.write(
      `\nNext step: restart your agent and run:\n   npx -y -p @a2hmarket/a2h-mcp a2h-mcp-login\n`,
    );
  }
}

/**
 * Spawn `npx -y -p @a2hmarket/a2h-mcp a2h-mcp-login`. We use the `-p <pkg>
 * <bin>` form because @a2hmarket/a2h-mcp exposes two separate bins
 * (`a2h-mcp` and `a2h-mcp-login`) and does not accept a `login` subcommand.
 */
function runLogin(apiBase?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ["-y", "-p", "@a2hmarket/a2h-mcp", "a2h-mcp-login"];
    const child = spawn("npx", args, {
      stdio: "inherit",
      env: { ...process.env, ...(apiBase ? { A2H_API_BASE: apiBase } : {}) },
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`login exit ${code}`)),
    );
    child.on("error", reject);
  });
}
