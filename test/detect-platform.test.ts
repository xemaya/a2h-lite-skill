import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectPlatform, resolveConfig } from "../src/detect-platform.js";

const PLATFORM_ENV_KEYS = [
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "OPENCLAW_RUNTIME",
  "HERMES_SESSION",
  "HOME",
] as const;

const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of PLATFORM_ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  // Redirect HOME to an empty tmp dir so on-disk sniffing doesn't match the
  // real user.
  process.env.HOME = mkdtempSync(join(tmpdir(), "a2h-detect-"));
});

afterEach(() => {
  for (const key of PLATFORM_ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

describe("detectPlatform", () => {
  it("returns claude-code when CLAUDECODE env is set", () => {
    process.env.CLAUDECODE = "1";
    expect(detectPlatform()).toBe("claude-code");
  });

  it("returns claude-code when CLAUDE_CODE_ENTRYPOINT is set", () => {
    process.env.CLAUDE_CODE_ENTRYPOINT = "cli";
    expect(detectPlatform()).toBe("claude-code");
  });

  it("returns openclaw when OPENCLAW_RUNTIME is set", () => {
    process.env.OPENCLAW_RUNTIME = "1";
    expect(detectPlatform()).toBe("openclaw");
  });

  it("returns hermes when HERMES_SESSION is set", () => {
    process.env.HERMES_SESSION = "1";
    expect(detectPlatform()).toBe("hermes");
  });

  it("returns unknown with no signals and empty HOME", () => {
    expect(detectPlatform()).toBe("unknown");
  });
});

describe("resolveConfig", () => {
  it("claude-code points to ~/.claude.json and ~/.claude/skills", () => {
    process.env.HOME = "/fake/home";
    const cfg = resolveConfig("claude-code");
    expect(cfg.mcpConfigPath).toBe("/fake/home/.claude.json");
    expect(cfg.skillsDir).toBe("/fake/home/.claude/skills");
  });

  it("openclaw has null skillsDir until beta confirms layout", () => {
    const cfg = resolveConfig("openclaw");
    expect(cfg.skillsDir).toBeNull();
  });

  it("unknown returns empty paths", () => {
    const cfg = resolveConfig("unknown");
    expect(cfg.mcpConfigPath).toBe("");
    expect(cfg.skillsDir).toBeNull();
    expect(cfg.restartCommand).toBe("");
  });
});
