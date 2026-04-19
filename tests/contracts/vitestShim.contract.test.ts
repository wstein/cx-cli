// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("Vitest native runner contract", () => {
  test("shared Vitest config does not alias bun:test", async () => {
    const shared = await fs.readFile(
      path.join(ROOT, "vitest.shared.ts"),
      "utf8",
    );

    expect(shared).not.toContain('"bun:test"');
    expect(shared).not.toContain("bun-test-shim.ts");
    expect(shared).not.toContain("alias:");
  });

  test("legacy bun-test shim helper is removed", async () => {
    await expect(
      fs.access(path.join(ROOT, "tests/helpers/vitest/bun-test-shim.ts")),
    ).rejects.toThrow();
  });
});
