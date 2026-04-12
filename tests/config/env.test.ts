import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  getCLIOverrides,
  readEnvOverrides,
  setCLIOverrides,
} from "../../src/config/env.js";

// Snapshot the env vars we will mutate so each test is isolated.
const MANAGED_VARS = [
  "CX_STRICT",
  "CX_DEDUP_MODE",
  "CX_REPOMIX_MISSING_EXTENSION",
  "CX_CONFIG_DUPLICATE_ENTRY",
  "CX_ASSETS_LAYOUT",
] as const;

type ManagedVar = (typeof MANAGED_VARS)[number];

let savedEnv: Partial<Record<ManagedVar, string | undefined>>;

beforeEach(() => {
  savedEnv = {};
  for (const key of MANAGED_VARS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of MANAGED_VARS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

describe("readEnvOverrides", () => {
  test("returns empty overrides when no env vars are set", () => {
    const overrides = readEnvOverrides();
    expect(overrides).toEqual({});
  });

  test("CX_STRICT=true forces all Category B settings to fail", () => {
    process.env.CX_STRICT = "true";
    const overrides = readEnvOverrides();
    expect(overrides.dedupMode).toBe("fail");
    expect(overrides.repomixMissingExtension).toBe("fail");
    expect(overrides.configDuplicateEntry).toBe("fail");
  });

  test("CX_STRICT=1 forces all Category B settings to fail", () => {
    process.env.CX_STRICT = "1";
    const overrides = readEnvOverrides();
    expect(overrides.dedupMode).toBe("fail");
    expect(overrides.repomixMissingExtension).toBe("fail");
    expect(overrides.configDuplicateEntry).toBe("fail");
  });

  test("CX_STRICT=true ignores per-area env vars", () => {
    process.env.CX_STRICT = "true";
    process.env.CX_DEDUP_MODE = "warn";
    const overrides = readEnvOverrides();
    // CX_STRICT takes precedence; per-area var is ignored.
    expect(overrides.dedupMode).toBe("fail");
  });

  test("CX_DEDUP_MODE=warn is accepted", () => {
    process.env.CX_DEDUP_MODE = "warn";
    const overrides = readEnvOverrides();
    expect(overrides.dedupMode).toBe("warn");
    expect(overrides.repomixMissingExtension).toBeUndefined();
    expect(overrides.configDuplicateEntry).toBeUndefined();
  });

  test("CX_DEDUP_MODE=first-wins is accepted", () => {
    process.env.CX_DEDUP_MODE = "first-wins";
    const overrides = readEnvOverrides();
    expect(overrides.dedupMode).toBe("first-wins");
  });

  test("CX_REPOMIX_MISSING_EXTENSION=fail is accepted", () => {
    process.env.CX_REPOMIX_MISSING_EXTENSION = "fail";
    const overrides = readEnvOverrides();
    expect(overrides.repomixMissingExtension).toBe("fail");
  });

  test("CX_CONFIG_DUPLICATE_ENTRY=first-wins is accepted", () => {
    process.env.CX_CONFIG_DUPLICATE_ENTRY = "first-wins";
    const overrides = readEnvOverrides();
    expect(overrides.configDuplicateEntry).toBe("first-wins");
  });

  test("rejects an invalid CX_DEDUP_MODE value", () => {
    process.env.CX_DEDUP_MODE = "silent";
    expect(() => readEnvOverrides()).toThrow(
      'CX_DEDUP_MODE must be one of: fail, warn, first-wins. Got: "silent".',
    );
  });

  test("rejects an invalid CX_REPOMIX_MISSING_EXTENSION value", () => {
    process.env.CX_REPOMIX_MISSING_EXTENSION = "ignore";
    expect(() => readEnvOverrides()).toThrow(
      'CX_REPOMIX_MISSING_EXTENSION must be one of: fail, warn. Got: "ignore".',
    );
  });

  test("rejects an invalid CX_CONFIG_DUPLICATE_ENTRY value", () => {
    process.env.CX_CONFIG_DUPLICATE_ENTRY = "skip";
    expect(() => readEnvOverrides()).toThrow(
      'CX_CONFIG_DUPLICATE_ENTRY must be one of: fail, warn, first-wins. Got: "skip".',
    );
  });

  test("per-area overrides are independent of each other", () => {
    process.env.CX_DEDUP_MODE = "warn";
    process.env.CX_CONFIG_DUPLICATE_ENTRY = "first-wins";
    const overrides = readEnvOverrides();
    expect(overrides.dedupMode).toBe("warn");
    expect(overrides.repomixMissingExtension).toBeUndefined();
    expect(overrides.configDuplicateEntry).toBe("first-wins");
  });

  test("CX_ASSETS_LAYOUT=flat is accepted", () => {
    process.env.CX_ASSETS_LAYOUT = "flat";
    const overrides = readEnvOverrides();
    expect(overrides.assetsLayout).toBe("flat");
  });

  test("CX_ASSETS_LAYOUT=deep is accepted", () => {
    process.env.CX_ASSETS_LAYOUT = "deep";
    const overrides = readEnvOverrides();
    expect(overrides.assetsLayout).toBe("deep");
  });

  test("CX_ASSETS_LAYOUT is read even when CX_STRICT is active", () => {
    process.env.CX_STRICT = "true";
    process.env.CX_ASSETS_LAYOUT = "deep";
    const overrides = readEnvOverrides();
    // CX_STRICT forces the three behavioral settings to "fail" but does not
    // suppress CX_ASSETS_LAYOUT.
    expect(overrides.dedupMode).toBe("fail");
    expect(overrides.assetsLayout).toBe("deep");
  });

  test("rejects an invalid CX_ASSETS_LAYOUT value", () => {
    process.env.CX_ASSETS_LAYOUT = "hierarchical";
    expect(() => readEnvOverrides()).toThrow(
      'CX_ASSETS_LAYOUT must be one of: flat, deep. Got: "hierarchical".',
    );
  });
});

describe("setCLIOverrides / getCLIOverrides", () => {
  afterEach(() => {
    // Reset after each test so CLI override state does not leak.
    setCLIOverrides({});
  });

  test("getCLIOverrides returns empty object by default", () => {
    setCLIOverrides({});
    expect(getCLIOverrides()).toEqual({});
  });

  test("setCLIOverrides / getCLIOverrides roundtrip", () => {
    setCLIOverrides({
      dedupMode: "fail",
      repomixMissingExtension: "fail",
      configDuplicateEntry: "fail",
    });
    const overrides = getCLIOverrides();
    expect(overrides.dedupMode).toBe("fail");
    expect(overrides.repomixMissingExtension).toBe("fail");
    expect(overrides.configDuplicateEntry).toBe("fail");
  });

  test("setCLIOverrides replaces previous state entirely", () => {
    setCLIOverrides({ dedupMode: "warn" });
    setCLIOverrides({ repomixMissingExtension: "fail" });
    const overrides = getCLIOverrides();
    // dedupMode from first call should be gone
    expect(overrides.dedupMode).toBeUndefined();
    expect(overrides.repomixMissingExtension).toBe("fail");
  });
});
