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
  test("vitest config uses V8 coverage with stable reporters", async () => {
    const config = await fs.readFile(
      path.join(ROOT, "vitest.config.ts"),
      "utf8",
    );

    expect(config).toContain("defineConfig");
    expect(config).toContain('provider: "v8"');
    expect(config).toContain('"json-summary"');
    expect(config).toContain('"html"');
    expect(config).toContain('"lcov"');
    expect(config).toContain('reportsDirectory: "./coverage/vitest"');
    expect(config).toContain('"bun:test"');
    expect(config).toContain("bun-test-shim.ts");
    expect(config).toContain('"tests/unit/**/*.test.ts"');
    expect(config).toContain('"tests/contracts/**/*.test.ts"');
    expect(config).toContain('"tests/config/**/*.test.ts"');
    expect(config).toContain('"tests/helpers/**"');
    expect(config).toContain("all: true");
  });
});
