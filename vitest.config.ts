import { defineCxVitestConfig } from "./vitest.shared.js";

export default defineCxVitestConfig({
  include: [
    "tests/unit/**/*.test.ts",
    "tests/contracts/**/*.test.ts",
    "tests/config/**/*.test.ts",
  ],
  reportsDirectory: "./coverage/vitest",
});
