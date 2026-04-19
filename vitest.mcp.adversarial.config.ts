import { defineCxVitestConfig } from "./vitest.shared.js";

export default defineCxVitestConfig(
  {
    include: [
      "tests/mcp/server.run.test.ts",
      "tests/mcp/toolRuntime.adversarial.test.ts",
    ],
    reportsDirectory: "./coverage/vitest-mcp-adversarial",
  },
  {
    test: {
      name: "mcp-adversarial-cockpit",
    },
  },
);
