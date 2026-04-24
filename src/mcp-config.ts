import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";

export interface McpServerEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpConfigFile {
  mcpServers?: Record<string, McpServerEntry>;
  [k: string]: unknown;
}

/**
 * Read an MCP config file. Missing file => empty object, so callers can treat
 * "never configured" and "configured but empty" uniformly.
 */
export function readMcpConfig(path: string): McpConfigFile {
  if (!existsSync(path)) {
    return {};
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const trimmed = raw.trim();
    if (!trimmed) {
      return {};
    }
    const parsed = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("top-level value must be a JSON object");
    }
    return parsed as McpConfigFile;
  } catch (e) {
    throw new Error(
      `existing config at ${path} is not valid JSON: ${(e as Error).message}`,
    );
  }
}

export function hasServer(cfg: McpConfigFile, name: string): boolean {
  return Boolean(cfg.mcpServers && cfg.mcpServers[name]);
}

/**
 * Non-destructive upsert. Preserves every other top-level key and every other
 * entry under `mcpServers` so we never stomp on a user's hand-curated config.
 */
export function upsertServer(
  cfg: McpConfigFile,
  name: string,
  entry: McpServerEntry,
): McpConfigFile {
  return {
    ...cfg,
    mcpServers: { ...(cfg.mcpServers ?? {}), [name]: entry },
  };
}

export function removeServer(
  cfg: McpConfigFile,
  name: string,
): McpConfigFile {
  if (!cfg.mcpServers || !(name in cfg.mcpServers)) {
    return cfg;
  }
  const next = { ...cfg.mcpServers };
  delete next[name];
  return { ...cfg, mcpServers: next };
}

/**
 * Pretty-print to disk atomically — write to a sibling temp file, then rename
 * over the target. Prevents Ctrl-C / OOM mid-write from truncating the user's
 * entire `.claude.json` (which holds projects/auth/tips, not just our entry).
 */
export function writeMcpConfig(path: string, cfg: McpConfigFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${randomBytes(6).toString("hex")}`;
  try {
    writeFileSync(tmp, JSON.stringify(cfg, null, 2) + "\n");
    renameSync(tmp, path);
  } catch (e) {
    // Best-effort cleanup. If the temp file never materialized the unlink will
    // itself throw — swallow that so the caller sees the original error.
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw e;
  }
}
