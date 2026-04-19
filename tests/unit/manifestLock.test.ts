// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  type CurrentBehaviorSnapshot,
  type CxLockFile,
  diffLockSettings,
  lockFileName,
  readLock,
  writeLock,
} from "../../src/manifest/lock.js";

let tmpDir: string | undefined;

function buildLock(): CxLockFile {
  return {
    schemaVersion: 1,
    cxVersion: "0.0.0-test",
    bundledAt: "2026-04-19T12:00:00.000Z",
    bundleMode: "ci",
    behavioralSettings: {
      "dedup.mode": { value: "fail", source: "cx.toml" },
      "repomix.missing_extension": {
        value: "warn",
        source: "compiled default",
      },
      "config.duplicate_entry": {
        value: "fail",
        source: "CX_STRICT",
      },
      "assets.layout": { value: "flat", source: "cli flag" },
      "manifest.include_linked_notes": {
        value: "true",
        source: "env var",
      },
    },
  };
}

function buildCurrentSnapshot(): CurrentBehaviorSnapshot {
  return {
    dedupMode: { value: "fail", source: "cx.toml" },
    repomixMissingExtension: {
      value: "warn",
      source: "compiled default",
    },
    configDuplicateEntry: { value: "fail", source: "CX_STRICT" },
    assetsLayout: { value: "flat", source: "cli flag" },
    includeLinkedNotes: { value: "true", source: "env var" },
  };
}

afterEach(async () => {
  if (tmpDir !== undefined) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

describe("manifest lock helpers", () => {
  test("writes and reads a valid lock file", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-lock-"));
    const lock = buildLock();

    await writeLock(tmpDir, "demo-project", lock);

    const filePath = path.join(tmpDir, lockFileName("demo-project"));
    expect(filePath.endsWith("demo-project-lock.json")).toBe(true);
    expect(JSON.parse(await fs.readFile(filePath, "utf8"))).toEqual(lock);
    await expect(readLock(tmpDir, "demo-project")).resolves.toEqual(lock);
  });

  test("returns null for missing or invalid lock files", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-lock-invalid-"));

    await expect(readLock(tmpDir, "missing")).resolves.toBeNull();

    await fs.writeFile(
      path.join(tmpDir, lockFileName("broken")),
      JSON.stringify({ schemaVersion: 99 }),
      "utf8",
    );
    await expect(readLock(tmpDir, "broken")).resolves.toBeNull();
  });

  test("reports only settings that drift from the locked snapshot", () => {
    const current = buildCurrentSnapshot();
    const mismatches = diffLockSettings(buildLock(), {
      ...current,
      dedupMode: { value: "warn", source: "env var" },
      includeLinkedNotes: { value: "false", source: "cli flag" },
    });

    expect(mismatches).toEqual([
      {
        setting: "dedup.mode",
        locked: "fail",
        lockedSource: "cx.toml",
        current: "warn",
        currentSource: "env var",
      },
      {
        setting: "manifest.include_linked_notes",
        locked: "true",
        lockedSource: "env var",
        current: "false",
        currentSource: "cli flag",
      },
    ]);
  });

  test("returns an empty list when behavioral settings match exactly", () => {
    expect(diffLockSettings(buildLock(), buildCurrentSnapshot())).toEqual([]);
  });
});
