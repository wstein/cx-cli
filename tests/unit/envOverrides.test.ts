// test-lane: unit
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  getCLIOverrides,
  readEnvOverrides,
  setCLIOverrides,
} from "../../src/config/env.js";

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.CX_STRICT;
  delete process.env.CX_DEDUP_MODE;
  delete process.env.CX_REPOMIX_MISSING_EXTENSION;
  delete process.env.CX_CONFIG_DUPLICATE_ENTRY;
  delete process.env.CX_ASSETS_LAYOUT;
  setCLIOverrides({});
});

afterEach(() => {
  process.env.CX_STRICT = originalEnv.CX_STRICT;
  process.env.CX_DEDUP_MODE = originalEnv.CX_DEDUP_MODE;
  process.env.CX_REPOMIX_MISSING_EXTENSION =
    originalEnv.CX_REPOMIX_MISSING_EXTENSION;
  process.env.CX_CONFIG_DUPLICATE_ENTRY = originalEnv.CX_CONFIG_DUPLICATE_ENTRY;
  process.env.CX_ASSETS_LAYOUT = originalEnv.CX_ASSETS_LAYOUT;
  setCLIOverrides({});
});

describe("readEnvOverrides", () => {
  test("returns empty overrides with no env vars", () => {
    const result = readEnvOverrides();
    expect(result).toEqual({});
  });

  test("throws on invalid CX_DEDUP_MODE", () => {
    process.env.CX_DEDUP_MODE = "invalid";
    expect(() => readEnvOverrides()).toThrow(/CX_DEDUP_MODE must be one of/);
  });

  test("throws on invalid CX_REPOMIX_MISSING_EXTENSION", () => {
    process.env.CX_REPOMIX_MISSING_EXTENSION = "bogus";
    expect(() => readEnvOverrides()).toThrow(
      /CX_REPOMIX_MISSING_EXTENSION must be one of/,
    );
  });

  test("throws on invalid CX_CONFIG_DUPLICATE_ENTRY", () => {
    process.env.CX_CONFIG_DUPLICATE_ENTRY = "wrong";
    expect(() => readEnvOverrides()).toThrow(
      /CX_CONFIG_DUPLICATE_ENTRY must be one of/,
    );
  });

  test("throws on invalid CX_ASSETS_LAYOUT", () => {
    process.env.CX_ASSETS_LAYOUT = "invalid";
    expect(() => readEnvOverrides()).toThrow(/CX_ASSETS_LAYOUT must be one of/);
  });

  test("reads valid CX_DEDUP_MODE", () => {
    process.env.CX_DEDUP_MODE = "warn";
    expect(readEnvOverrides().dedupMode).toBe("warn");
  });

  test("reads valid CX_REPOMIX_MISSING_EXTENSION", () => {
    process.env.CX_REPOMIX_MISSING_EXTENSION = "warn";
    expect(readEnvOverrides().repomixMissingExtension).toBe("warn");
  });

  test("reads valid CX_CONFIG_DUPLICATE_ENTRY", () => {
    process.env.CX_CONFIG_DUPLICATE_ENTRY = "first-wins";
    expect(readEnvOverrides().configDuplicateEntry).toBe("first-wins");
  });

  test("reads CX_ASSETS_LAYOUT independently", () => {
    process.env.CX_ASSETS_LAYOUT = "deep";
    expect(readEnvOverrides().assetsLayout).toBe("deep");
  });

  test("CX_STRICT=true forces all Category B settings to fail", () => {
    process.env.CX_STRICT = "true";
    process.env.CX_DEDUP_MODE = "warn";
    const result = readEnvOverrides();
    expect(result.dedupMode).toBe("fail");
    expect(result.repomixMissingExtension).toBe("fail");
    expect(result.configDuplicateEntry).toBe("fail");
  });

  test("CX_STRICT=1 also triggers strict mode", () => {
    process.env.CX_STRICT = "1";
    const result = readEnvOverrides();
    expect(result.dedupMode).toBe("fail");
  });

  test("CX_STRICT does not force CX_ASSETS_LAYOUT", () => {
    process.env.CX_STRICT = "true";
    process.env.CX_ASSETS_LAYOUT = "deep";
    expect(readEnvOverrides().assetsLayout).toBe("deep");
  });
});

describe("CLI overrides", () => {
  test("getCLIOverrides returns empty initially", () => {
    expect(getCLIOverrides()).toEqual({});
  });

  test("setCLIOverrides stores values", () => {
    setCLIOverrides({ dedupMode: "fail", repomixMissingExtension: "warn" });
    expect(getCLIOverrides().dedupMode).toBe("fail");
    expect(getCLIOverrides().repomixMissingExtension).toBe("warn");
  });

  test("setCLIOverrides replaces previous overrides", () => {
    setCLIOverrides({ dedupMode: "fail" });
    setCLIOverrides({ dedupMode: "warn" });
    expect(getCLIOverrides().dedupMode).toBe("warn");
  });
});
