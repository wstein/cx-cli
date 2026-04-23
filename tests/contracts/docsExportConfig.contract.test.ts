// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("docs export config contract", () => {
  test("checked-in cx.toml keeps derived docs exports in a dedicated directory", async () => {
    const config = await fs.readFile(path.join(ROOT, "cx.toml"), "utf8");

    expect(config).toContain(
      '[docs]\ntarget_dir = "docs-exports"\nroot_level = 1',
    );
    expect(config).not.toContain('[docs]\ntarget_dir = "."');
  });
});
