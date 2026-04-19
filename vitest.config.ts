import { defineCxVitestConfig } from "./vitest.shared.js";

export default defineCxVitestConfig({
  include: ["tests/**/*.test.ts"],
  reportsDirectory: "./coverage/vitest",
});
