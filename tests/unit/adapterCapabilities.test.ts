// test-lane: unit
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  detectAdapterCapabilities,
  getAdapterCapabilities,
  getAdapterModulePath,
  getAdapterRuntimeInfo,
  getReferenceAdapterRuntimeInfo,
  requireAdapterContract,
  setAdapterPath,
  validateAdapterContract,
} from "../../src/adapter/capabilities.js";

const REAL_PATH = getAdapterModulePath();
const BAD_PATH = "__nonexistent_repomix_pkg_xyz__";

beforeEach(() => {
  setAdapterPath(REAL_PATH);
});

afterEach(() => {
  setAdapterPath(REAL_PATH);
});

describe("detectAdapterCapabilities", () => {
  test("returns all false when adapter module cannot be loaded", async () => {
    setAdapterPath(BAD_PATH);
    const caps = await detectAdapterCapabilities();
    expect(caps.hasMergeConfigs).toBe(false);
    expect(caps.hasPack).toBe(false);
    expect(caps.supportsPackStructured).toBe(false);
    expect(caps.supportsRenderWithMap).toBe(false);
  });
});

describe("getAdapterRuntimeInfo", () => {
  test("tries default adapter fallback when custom path fails", async () => {
    setAdapterPath(BAD_PATH);
    const info = await getAdapterRuntimeInfo();
    expect(info.packageVersion).toBeDefined();
    expect(typeof info.packageName).toBe("string");
  });
});

describe("validateAdapterContract", () => {
  test("returns invalid contract when mergeConfigs is absent", async () => {
    setAdapterPath(BAD_PATH);
    const result = await validateAdapterContract();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.join("\n")).toContain(BAD_PATH);
    }
  });
});

describe("requireAdapterContract", () => {
  test("throws when contract is invalid", async () => {
    setAdapterPath(BAD_PATH);
    await expect(requireAdapterContract()).rejects.toThrow();
  });
});

describe("getAdapterCapabilities", () => {
  test("returns combined runtime info, capabilities, and contract state", async () => {
    const result = await getAdapterCapabilities();
    expect(typeof result.oracleAdapter.packageName).toBe("string");
    expect(typeof result.oracleAdapter.packageVersion).toBe("string");
    expect(typeof result.oracleAdapter.contractValid).toBe("boolean");
    expect(Array.isArray(result.oracleAdapter.contractErrors)).toBe(true);
    expect(result.referenceAdapter.packageName).toBe("repomix");
    expect(typeof result.referenceAdapter.installed).toBe("boolean");
    expect(typeof result.capabilities.hasMergeConfigs).toBe("boolean");
  });

  test("contractErrors is non-empty when adapter is missing", async () => {
    setAdapterPath(BAD_PATH);
    const result = await getAdapterCapabilities();
    expect(result.oracleAdapter.contractValid).toBe(false);
    expect(result.oracleAdapter.contractErrors.length).toBeGreaterThan(0);
  });
});

describe("getReferenceAdapterRuntimeInfo", () => {
  test("returns a stable reference adapter target", async () => {
    const result = await getReferenceAdapterRuntimeInfo();
    expect(result.packageName).toBe("repomix");
    expect(typeof result.installed).toBe("boolean");
  });
});
