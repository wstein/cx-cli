// test-lane: contract
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("Vitest coverage contract", () => {
  test("shared vitest helper keeps V8 coverage and Bun compatibility stable", async () => {
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
    expect(shared).toContain('"bun:test"');
    expect(shared).toContain("bun-test-shim.ts");
    expect(shared).toContain('"tests/helpers/**"');
    expect(shared).toContain("all: true");
    expect(config).toContain("defineCxVitestConfig");
    expect(config).toContain('reportsDirectory: "./coverage/vitest"');
    expect(config).toContain('"tests/unit/**/*.test.ts"');
    expect(config).toContain('"tests/contracts/**/*.test.ts"');
    expect(config).toContain('"tests/config/**/*.test.ts"');
    expect(config).toContain('"tests/mcp/**/*.test.ts"');
    expect(config).toContain('"tests/cli/mcp*.test.ts"');
  });
});
