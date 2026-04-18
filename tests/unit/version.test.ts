// test-lane: unit
import { describe, expect, test } from "bun:test";

import packageJson from "../../package.json" with { type: "json" };
import { CX_VERSION } from "../../src/shared/version.js";

describe("shared version utility", () => {
  test("CX_VERSION matches package.json version", () => {
    expect(CX_VERSION).toBe(packageJson.version);
  });
});
