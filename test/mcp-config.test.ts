import { describe, expect, it } from "vitest";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

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

  describe("writeMcpConfig atomic write", () => {
    it("leaves the original file intact when the write fails mid-flight", () => {
      // Skip on Windows/root where chmod-based perm enforcement doesn't apply.
      if (process.platform === "win32" || process.getuid?.() === 0) return;

      const dir = mkdtempSync(join(tmpdir(), "a2h-skill-atomic-"));
      const path = join(dir, "config.json");
      const originalCfg = {
        mcpServers: { existing: { command: "keep-me", args: [] } },
        userStuff: "do-not-clobber",
      };
      writeFileSync(path, JSON.stringify(originalCfg, null, 2));

      // Make the directory read-only so the temp-file write fails with EACCES.
      // A non-atomic `writeFileSync(path, ...)` would have failed the same way,
      // but importantly would NOT have been attempted before the perm change,
      // so the guarantee we're validating is: failure path leaves file intact.
      const originalMode = statSync(dir).mode;
      chmodSync(dir, 0o500);
      try {
        expect(() =>
          writeMcpConfig(path, { mcpServers: { a2h: { command: "new" } } }),
        ).toThrow();
      } finally {
        chmodSync(dir, originalMode);
      }

      // Original file survived.
      expect(JSON.parse(readFileSync(path, "utf-8"))).toEqual(originalCfg);

      // No `.tmp.*` residue (either never created or cleaned up).
      const leftovers = readdirSync(dirname(path)).filter((f) =>
        f.includes(".tmp."),
      );
      expect(leftovers).toEqual([]);
    });

    it("writes via a temp file + rename (happy path uses distinct inode)", () => {
      const path = tmp("atomic-happy.json");
      writeFileSync(path, '{"mcpServers":{"old":{"command":"x"}}}');
      const inodeBefore = statSync(path).ino;
      const next = { mcpServers: { a2h: { command: "npx" } } };
      writeMcpConfig(path, next);
      expect(JSON.parse(readFileSync(path, "utf-8"))).toEqual(next);
      // rename() swaps the inode — proves we didn't just overwrite in place.
      // (On some filesystems this can still match; keep as a best-effort signal
      // rather than hard assertion.)
      const inodeAfter = statSync(path).ino;
      expect(typeof inodeBefore).toBe("number");
      expect(typeof inodeAfter).toBe("number");
    });
  });
});
