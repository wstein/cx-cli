// test-lane: contract

import { describe, expect, test } from "vitest";
import {
  DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_CONFIG_VALUES,
} from "../../src/config/defaults.js";

describe("docs export config contract", () => {
  test("defaults keep derived docs exports in a dedicated directory", () => {
    expect(DEFAULT_CONFIG_VALUES.docs.targetDir).toBe("{project}-docs-exports");
    expect(DEFAULT_CONFIG_VALUES.docs.rootLevel).toBe(1);
    expect(DEFAULT_CONFIG_VALUES.docs.targetDir).not.toBe(".");
  });

  test("generated config template keeps derived docs exports in a dedicated directory", () => {
    expect(DEFAULT_CONFIG_TEMPLATE).toContain(
      '[docs]\ntarget_dir = "{project}-docs-exports"',
    );
    expect(DEFAULT_CONFIG_TEMPLATE).toContain("root_level = 1");
    expect(DEFAULT_CONFIG_TEMPLATE).not.toContain('[docs]\ntarget_dir = "."');
  });
});
