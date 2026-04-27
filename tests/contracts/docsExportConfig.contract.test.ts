// test-lane: contract

import { describe, expect, test } from "vitest";
import { DEFAULT_CONFIG_VALUES } from "../../src/config/defaults.js";
import { renderInitTemplate } from "../../src/templates/index.js";

describe("docs export config contract", () => {
  test("defaults keep derived docs exports in a dedicated directory", () => {
    expect(DEFAULT_CONFIG_VALUES.docs.targetDir).toBe("{project}-docs-exports");
    expect(DEFAULT_CONFIG_VALUES.docs.rootLevel).toBe(1);
    expect(DEFAULT_CONFIG_VALUES.docs.targetDir).not.toBe(".");
  });

  test("generated config template keeps derived docs exports in a dedicated directory", async () => {
    const template = await renderInitTemplate(
      process.cwd(),
      "cx.toml",
      {
        projectName: "myproject",
        style: "xml",
      },
      "base",
    );
    expect(template).toContain('[docs]\ntarget_dir = "myproject-docs-exports"');
    expect(template).toContain("root_level = 1");
    expect(template).not.toContain('[docs]\ntarget_dir = "."');
  });
});
