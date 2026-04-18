// test-lane: integration
import { describe, expect, test } from "bun:test";
import {
  type CurrentBehaviorSnapshot,
  type CxLockFile,
  diffLockSettings,
} from "../../src/manifest/lock.js";

function makeLock(
  overrides: Partial<CxLockFile["behavioralSettings"]> = {},
): CxLockFile {
  return {
    schemaVersion: 1,
    cxVersion: "0.0.0-test",
    bundledAt: new Date().toISOString(),
    behavioralSettings: {
      "dedup.mode": { value: "fail", source: "compiled default" },
      "repomix.missing_extension": {
        value: "warn",
        source: "compiled default",
      },
      "config.duplicate_entry": { value: "fail", source: "compiled default" },
      "assets.layout": { value: "flat", source: "compiled default" },
      "manifest.include_linked_notes": {
        value: "false",
        source: "compiled default",
      },
      ...overrides,
    },
  };
}

function makeSnapshot(
  overrides: Partial<CurrentBehaviorSnapshot> = {},
): CurrentBehaviorSnapshot {
  return {
    dedupMode: { value: "fail", source: "compiled default" },
    repomixMissingExtension: { value: "warn", source: "compiled default" },
    configDuplicateEntry: { value: "fail", source: "compiled default" },
    assetsLayout: { value: "flat", source: "compiled default" },
    includeLinkedNotes: { value: "false", source: "compiled default" },
    ...overrides,
  };
}

describe("diffLockSettings", () => {
  test("returns no mismatches when all settings match", () => {
    expect(diffLockSettings(makeLock(), makeSnapshot())).toEqual([]);
  });

  test("detects drift in assets.layout", () => {
    const lock = makeLock({
      "assets.layout": { value: "flat", source: "compiled default" },
      "manifest.include_linked_notes": {
        value: "false",
        source: "compiled default",
      },
    });
    const current = makeSnapshot({
      assetsLayout: { value: "deep", source: "cx.toml" },
    });
    const mismatches = diffLockSettings(lock, current);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      setting: "assets.layout",
      locked: "flat",
      lockedSource: "compiled default",
      current: "deep",
      currentSource: "cx.toml",
    });
  });

  test("detects drift only in the changed setting and no others", () => {
    const lock = makeLock({
      "assets.layout": { value: "deep", source: "cx.toml" },
      "manifest.include_linked_notes": {
        value: "false",
        source: "compiled default",
      },
    });
    // All other settings match; only layout differs
    const current = makeSnapshot({
      assetsLayout: { value: "flat", source: "env var" },
    });
    const mismatches = diffLockSettings(lock, current);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]?.setting).toBe("assets.layout");
  });

  test("detects drift in multiple settings simultaneously", () => {
    const lock = makeLock({
      "dedup.mode": { value: "fail", source: "compiled default" },
      "assets.layout": { value: "flat", source: "compiled default" },
    });
    const current = makeSnapshot({
      dedupMode: { value: "warn", source: "cx.toml" },
      assetsLayout: { value: "deep", source: "cx.toml" },
    });
    const mismatches = diffLockSettings(lock, current);
    expect(mismatches).toHaveLength(2);
    const settings = mismatches.map((m) => m.setting).sort();
    expect(settings).toEqual(["assets.layout", "dedup.mode"]);
  });

  test("no drift when assets.layout matches even if source differs", () => {
    // Drift is value-based, not source-based
    const lock = makeLock({
      "assets.layout": { value: "deep", source: "compiled default" },
    });
    const current = makeSnapshot({
      assetsLayout: { value: "deep", source: "cx.toml" },
    });
    expect(diffLockSettings(lock, current)).toEqual([]);
  });
});
