import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { install } from "../src/install.js";
import { uninstall } from "../src/uninstall.js";

const SAVE_KEYS = [
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "OPENCLAW_RUNTIME",
  "HERMES_SESSION",
  "HOME",
  "A2H_HOME",
] as const;

const originalEnv: Record<string, string | undefined> = {};

// Mock spawn so install with login=true doesn't actually shell out to npx.
vi.mock("node:child_process", async () => {
  const actual =
    await vi.importActual<typeof import("node:child_process")>(
      "node:child_process",
    );
  return {
    ...actual,
    spawn: vi.fn(() => {
      const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
      const child = {
        on(ev: string, cb: (...args: unknown[]) => void) {
          handlers[ev] ??= [];
          handlers[ev].push(cb);
          return child;
        },
      };
      // Fire exit(0) on next tick so the Promise in runLogin resolves.
      setImmediate(() => {
        for (const cb of handlers["exit"] ?? []) cb(0);
      });
      return child as unknown as ReturnType<
        typeof import("node:child_process").spawn
      >;
    }),
  };
});

beforeEach(() => {
  for (const key of SAVE_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  const home = mkdtempSync(join(tmpdir(), "a2h-install-"));
  process.env.HOME = home;
  process.env.A2H_HOME = join(home, ".a2h");
  process.env.CLAUDECODE = "1";
});

afterEach(() => {
  for (const key of SAVE_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

describe("install", () => {
  it("writes .claude.json with a2h MCP server and skill.md (no-login)", async () => {
    await install({ login: false });

    const mcpPath = join(process.env.HOME!, ".claude.json");
    expect(existsSync(mcpPath)).toBe(true);
    const cfg = JSON.parse(readFileSync(mcpPath, "utf-8"));
    expect(cfg.mcpServers.a2h.command).toBe("npx");
    expect(cfg.mcpServers.a2h.args).toEqual(["-y", "@a2hmarket/a2h-mcp"]);

    const skillPath = join(
      process.env.HOME!,
      ".claude",
      "skills",
      "a2hmarket.md",
    );
    expect(existsSync(skillPath)).toBe(true);
    const skillBody = readFileSync(skillPath, "utf-8");
    expect(skillBody).toMatch(/^---\nname: a2hmarket/);
  });

  it("is idempotent — second run does not overwrite existing a2h entry", async () => {
    const mcpPath = join(process.env.HOME!, ".claude.json");
    // User had a hand-curated entry.
    writeFileSync(
      mcpPath,
      JSON.stringify({
        mcpServers: {
          a2h: { command: "custom", args: ["--foo"] },
          other: { command: "other-bin" },
        },
      }),
    );

    await install({ login: false });
    const cfg = JSON.parse(readFileSync(mcpPath, "utf-8"));
    expect(cfg.mcpServers.a2h).toEqual({ command: "custom", args: ["--foo"] });
    expect(cfg.mcpServers.other).toEqual({ command: "other-bin" });
  });

  it("preserves unrelated mcpServers entries when adding a2h", async () => {
    const mcpPath = join(process.env.HOME!, ".claude.json");
    writeFileSync(
      mcpPath,
      JSON.stringify({
        mcpServers: {
          filesystem: { command: "npx", args: ["-y", "@mcp/filesystem"] },
        },
        someOtherKey: { nested: true },
      }),
    );

    await install({ login: false });

    const cfg = JSON.parse(readFileSync(mcpPath, "utf-8"));
    expect(cfg.mcpServers.filesystem).toBeDefined();
    expect(cfg.mcpServers.a2h).toBeDefined();
    expect(cfg.someOtherKey).toEqual({ nested: true });
  });

  it("records apiBase in env when provided", async () => {
    await install({ login: false, apiBase: "https://api-staging.example" });
    const cfg = JSON.parse(
      readFileSync(join(process.env.HOME!, ".claude.json"), "utf-8"),
    );
    expect(cfg.mcpServers.a2h.env).toEqual({
      A2H_API_BASE: "https://api-staging.example",
    });
  });

  it("re-upserts a2h entry when apiBase changes on a re-install", async () => {
    const mcpPath = join(process.env.HOME!, ".claude.json");
    // First install points at prod (no env).
    await install({ login: false });
    let cfg = JSON.parse(readFileSync(mcpPath, "utf-8"));
    expect(cfg.mcpServers.a2h.env).toBeUndefined();

    // Second install with --api-base must update the entry, not skip it.
    await install({ login: false, apiBase: "https://api-staging.example" });
    cfg = JSON.parse(readFileSync(mcpPath, "utf-8"));
    expect(cfg.mcpServers.a2h.env).toEqual({
      A2H_API_BASE: "https://api-staging.example",
    });
  });

  it("spawns login with the -p @a2hmarket/a2h-mcp a2h-mcp-login bin form", async () => {
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockClear();
    await install({ login: true });
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(
      "npx",
      ["-y", "-p", "@a2hmarket/a2h-mcp", "a2h-mcp-login"],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("runs login on re-install when credentials are still missing", async () => {
    // First run: writes config, but we simulate login failing silently by
    // running --no-login (equivalent outcome: no credentials on disk).
    await install({ login: false });

    const spawnMock = vi.mocked(spawn);
    spawnMock.mockClear();

    // Second run with login=true. Old behaviour: hasServer → skip login.
    // New behaviour: config is present but creds missing → still log in.
    await install({ login: true });
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("skips login on re-install when credentials already exist", async () => {
    await install({ login: false });

    // Plant a credentials file under A2H_HOME.
    mkdirSync(process.env.A2H_HOME!, { recursive: true });
    writeFileSync(
      join(process.env.A2H_HOME!, "credentials.json"),
      JSON.stringify({ tokenName: "test", agentId: "ag_test" }),
    );

    const spawnMock = vi.mocked(spawn);
    spawnMock.mockClear();

    await install({ login: true });
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

describe("uninstall", () => {
  it("removes the a2h entry and skill.md but leaves other servers alone", async () => {
    await install({ login: false });
    const mcpPath = join(process.env.HOME!, ".claude.json");
    // Add an unrelated server before uninstall.
    const cfgBefore = JSON.parse(readFileSync(mcpPath, "utf-8"));
    cfgBefore.mcpServers.other = { command: "other-bin" };
    writeFileSync(mcpPath, JSON.stringify(cfgBefore));

    uninstall();

    const cfgAfter = JSON.parse(readFileSync(mcpPath, "utf-8"));
    expect(cfgAfter.mcpServers.a2h).toBeUndefined();
    expect(cfgAfter.mcpServers.other).toEqual({ command: "other-bin" });

    const skillPath = join(
      process.env.HOME!,
      ".claude",
      "skills",
      "a2hmarket.md",
    );
    expect(existsSync(skillPath)).toBe(false);
  });
});
