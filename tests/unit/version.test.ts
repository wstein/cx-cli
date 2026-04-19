// test-lane: unit
import { describe, expect, test } from "vitest";

import packageJson from "../../package.json" with { type: "json" };
import { CX_DISPLAY_VERSION, CX_VERSION } from "../../src/shared/version.js";

describe("shared version utility", () => {
  test("CX_VERSION matches package.json version", () => {
    expect(CX_VERSION).toBe(packageJson.version);
  });

  test("CX_DISPLAY_VERSION prefixes the package version for CLI output", () => {
    expect(CX_DISPLAY_VERSION).toBe(`v${packageJson.version}`);
  });
});
