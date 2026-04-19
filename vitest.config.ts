import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "bun:test": fileURLToPath(
        new URL("./tests/helpers/vitest/bun-test-shim.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: [
      "tests/unit/**/*.test.ts",
      "tests/contracts/**/*.test.ts",
      "tests/config/**/*.test.ts",
    ],
    environment: "node",
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      reportsDirectory: "./coverage/vitest",
      exclude: [
        "dist/**",
        "coverage/**",
        "node_modules/**",
        "tests/helpers/**",
        "scripts/**",
        "**/*.d.ts",
      ],
      all: true,
    },
  },
});
