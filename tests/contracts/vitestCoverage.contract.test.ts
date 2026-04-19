// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("Vitest coverage contract", () => {
  test("shared vitest helper keeps V8 coverage native and repository-wide", async () => {
    const shared = await fs.readFile(
      path.join(ROOT, "vitest.shared.ts"),
      "utf8",
    );
    const config = await fs.readFile(
      path.join(ROOT, "vitest.config.ts"),
      "utf8",
    );

    expect(shared).toContain('provider: "v8"');
    expect(shared).toContain('"json-summary"');
    expect(shared).toContain('"html"');
    expect(shared).toContain('"lcov"');
    expect(shared).toContain('"tests/helpers/**"');
    expect(shared).toContain("all: true");
    expect(config).toContain("defineCxVitestConfig");
    expect(config).toContain('reportsDirectory: "./coverage/vitest"');
    expect(config).toContain('"tests/**/*.test.ts"');
  });
});
