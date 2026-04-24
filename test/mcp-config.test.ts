import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  hasServer,
  readMcpConfig,
  removeServer,
  upsertServer,
  writeMcpConfig,
} from "../src/mcp-config.js";

function tmp(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), "a2h-skill-test-"));
  return join(dir, name);
}

describe("mcp-config", () => {
  it("readMcpConfig returns empty object when file is missing", () => {
    const path = tmp("missing.json");
    expect(readMcpConfig(path)).toEqual({});
  });

  it("readMcpConfig throws on invalid JSON", () => {
    const path = tmp("bad.json");
    writeFileSync(path, "{ not valid");
    expect(() => readMcpConfig(path)).toThrow(/not valid JSON/);
  });

  it("upsertServer preserves other servers and top-level keys", () => {
    const cfg = {
      someOtherTopLevelKey: "keep-me",
      mcpServers: {
        foo: { command: "foo-bin", args: ["--x"] },
      },
    };
    const next = upsertServer(cfg, "a2h", {
      command: "npx",
      args: ["-y", "@a2hmarket/a2h-mcp"],
    });
    expect(next.someOtherTopLevelKey).toBe("keep-me");
    expect(next.mcpServers?.foo).toEqual({ command: "foo-bin", args: ["--x"] });
    expect(next.mcpServers?.a2h?.command).toBe("npx");
  });

  it("upsertServer overwrites the same name without touching others", () => {
    const cfg = {
      mcpServers: {
        a2h: { command: "old", args: [] },
        foo: { command: "foo-bin" },
      },
    };
    const next = upsertServer(cfg, "a2h", { command: "new", args: ["-y"] });
    expect(next.mcpServers?.a2h).toEqual({ command: "new", args: ["-y"] });
    expect(next.mcpServers?.foo).toEqual({ command: "foo-bin" });
  });

  it("removeServer drops only the named server", () => {
    const cfg = {
      mcpServers: {
        a2h: { command: "npx" },
        foo: { command: "foo-bin" },
      },
    };
    const next = removeServer(cfg, "a2h");
    expect(next.mcpServers).toEqual({ foo: { command: "foo-bin" } });
  });

  it("removeServer is a no-op when server not present", () => {
    const cfg = { mcpServers: { foo: { command: "foo-bin" } } };
    const next = removeServer(cfg, "a2h");
    expect(next.mcpServers).toEqual({ foo: { command: "foo-bin" } });
  });

  it("hasServer detects presence correctly", () => {
    expect(hasServer({}, "a2h")).toBe(false);
    expect(hasServer({ mcpServers: {} }, "a2h")).toBe(false);
    expect(
      hasServer({ mcpServers: { a2h: { command: "x" } } }, "a2h"),
    ).toBe(true);
  });

  it("writeMcpConfig creates parent dirs and round-trips", () => {
    const path = tmp("nested/dir/config.json");
    const cfg = { mcpServers: { a2h: { command: "npx", args: ["-y"] } } };
    writeMcpConfig(path, cfg);
    const roundtripped = JSON.parse(readFileSync(path, "utf-8"));
    expect(roundtripped).toEqual(cfg);
  });
});
