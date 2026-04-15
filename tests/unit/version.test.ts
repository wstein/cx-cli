import { describe, expect, test } from "bun:test";

import { CX_VERSION } from "../../src/shared/version.js";
import packageJson from "../../package.json" with { type: "json" };

describe("shared version utility", () => {
  test("CX_VERSION matches package.json version", () => {
    expect(CX_VERSION).toBe(packageJson.version);
  });
});
