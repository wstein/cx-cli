import { defineCxVitestConfig } from "./vitest.shared.js";

export default defineCxVitestConfig(
  {
    include: [
      "tests/mcp/**/*.test.ts",
      "tests/cli/mcp*.test.ts",
      "tests/unit/mcp*.test.ts",
      "tests/unit/doctorMcpReport.test.ts",
      "tests/contracts/mcpPolicy.contract.test.ts",
    ],
    reportsDirectory: "./coverage/vitest-mcp",
  },
  {
    test: {
      name: "mcp-cockpit",
    },
  },
);
