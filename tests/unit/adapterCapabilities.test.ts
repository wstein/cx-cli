// test-lane: unit
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  detectOracleAdapterCapabilities,
  getOracleAdapterCapabilities,
  getOracleAdapterModulePath,
  getOracleAdapterRuntimeInfo,
  getReferenceOracleRuntimeInfo,
  requireOracleAdapterContract,
  setOracleAdapterPath,
  validateOracleAdapterContract,
} from "../../src/adapter/capabilities.js";

const REAL_PATH = getOracleAdapterModulePath();
const BAD_PATH = "__nonexistent_repomix_pkg_xyz__";

beforeEach(() => {
  setOracleAdapterPath(REAL_PATH);
});

afterEach(() => {
  setOracleAdapterPath(REAL_PATH);
});

describe("detectOracleAdapterCapabilities", () => {
  test("returns all false when adapter module cannot be loaded", async () => {
    setOracleAdapterPath(BAD_PATH);
    const caps = await detectOracleAdapterCapabilities();
    expect(caps.hasMergeConfigs).toBe(false);
    expect(caps.hasPack).toBe(false);
    expect(caps.supportsPackStructured).toBe(false);
    expect(caps.supportsRenderWithMap).toBe(false);
  });
});

describe("getOracleAdapterRuntimeInfo", () => {
  test("tries default adapter fallback when custom path fails", async () => {
    setOracleAdapterPath(BAD_PATH);
    const info = await getOracleAdapterRuntimeInfo();
    expect(info.packageVersion).toBeDefined();
    expect(typeof info.packageName).toBe("string");
  });
});

describe("validateOracleAdapterContract", () => {
  test("returns invalid contract when mergeConfigs is absent", async () => {
    setOracleAdapterPath(BAD_PATH);
    const result = await validateOracleAdapterContract();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.join("\n")).toContain(BAD_PATH);
    }
  });
});

describe("requireOracleAdapterContract", () => {
  test("throws when contract is invalid", async () => {
    setOracleAdapterPath(BAD_PATH);
    await expect(requireOracleAdapterContract()).rejects.toThrow();
  });
});

describe("getOracleAdapterCapabilities", () => {
  test("returns combined runtime info, capabilities, and contract state", async () => {
    const result = await getOracleAdapterCapabilities();
    expect(typeof result.oracleAdapter.packageName).toBe("string");
    expect(typeof result.oracleAdapter.packageVersion).toBe("string");
    expect(typeof result.oracleAdapter.contractValid).toBe("boolean");
    expect(Array.isArray(result.oracleAdapter.contractErrors)).toBe(true);
    expect(result.referenceAdapter.packageName).toBe("repomix");
    expect(typeof result.referenceAdapter.installed).toBe("boolean");
    expect(typeof result.capabilities.hasMergeConfigs).toBe("boolean");
  });

  test("contractErrors is non-empty when adapter is missing", async () => {
    setOracleAdapterPath(BAD_PATH);
    const result = await getOracleAdapterCapabilities();
    expect(result.oracleAdapter.contractValid).toBe(false);
    expect(result.oracleAdapter.contractErrors.length).toBeGreaterThan(0);
  });
});

describe("getReferenceOracleRuntimeInfo", () => {
  test("returns a stable reference adapter target", async () => {
    const result = await getReferenceOracleRuntimeInfo();
    expect(result.packageName).toBe("repomix");
    expect(typeof result.installed).toBe("boolean");
  });
});
