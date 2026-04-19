import { defineCxVitestConfig } from "./vitest.shared.js";

export default defineCxVitestConfig({
  include: [
    "tests/unit/**/*.test.ts",
    "tests/contracts/**/*.test.ts",
    "tests/config/**/*.test.ts",
    "tests/mcp/**/*.test.ts",
    "tests/cli/mcp*.test.ts",
  ],
  reportsDirectory: "./coverage/vitest",
});
