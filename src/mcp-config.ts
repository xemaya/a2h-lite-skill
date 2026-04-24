import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
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

/** Pretty-print to disk, creating parent dirs as needed. */
export function writeMcpConfig(path: string, cfg: McpConfigFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
}
