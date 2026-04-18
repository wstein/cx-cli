import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  detectRepomixCapabilities,
  getAdapterModulePath,
  getAdapterRuntimeInfo,
  getRepomixCapabilities,
  requireRepomixContract,
  setAdapterPath,
  validateRepomixContract,
} from "../../src/repomix/capabilities.js";

const REAL_PATH = getAdapterModulePath();
const BAD_PATH = "__nonexistent_repomix_pkg_xyz__";

beforeEach(() => {
  setAdapterPath(REAL_PATH);
});

afterEach(() => {
  setAdapterPath(REAL_PATH);
});

describe("detectRepomixCapabilities", () => {
  test("returns all false when adapter module cannot be loaded", async () => {
    setAdapterPath(BAD_PATH);
    const caps = await detectRepomixCapabilities();
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

describe("validateRepomixContract", () => {
  test("returns invalid contract when mergeConfigs is absent", async () => {
    setAdapterPath(BAD_PATH);
    const result = await validateRepomixContract();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("mergeConfigs");
    }
  });
});

describe("requireRepomixContract", () => {
  test("throws when contract is invalid", async () => {
    setAdapterPath(BAD_PATH);
    await expect(requireRepomixContract()).rejects.toThrow();
  });
});

describe("getRepomixCapabilities", () => {
  test("returns combined runtime info, capabilities, and contract state", async () => {
    const result = await getRepomixCapabilities();
    expect(typeof result.packageName).toBe("string");
    expect(typeof result.packageVersion).toBe("string");
    expect(typeof result.contractValid).toBe("boolean");
    expect(Array.isArray(result.contractErrors)).toBe(true);
    expect(typeof result.capabilities.hasMergeConfigs).toBe("boolean");
  });

  test("contractErrors is non-empty when adapter is missing", async () => {
    setAdapterPath(BAD_PATH);
    const result = await getRepomixCapabilities();
    expect(result.contractValid).toBe(false);
    expect(result.contractErrors.length).toBeGreaterThan(0);
  });
});
