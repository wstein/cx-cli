// test-lane: unit
import { describe, expect, test } from "vitest";
import { defineCxVitestConfig } from "../../vitest.shared.js";

function getCoverageDirectory(config: unknown): string | undefined {
  return (config as { test?: { coverage?: { reportsDirectory?: string } } })
    .test?.coverage?.reportsDirectory;
}

function getIncludePatterns(config: unknown): string[] {
  return [
    ...(((config as { test?: { include?: string[] } }).test?.include ??
      []) as string[]),
  ];
}

function isCoverageEnabled(config: unknown): boolean | undefined {
  return (config as { test?: { coverage?: { enabled?: boolean } } }).test
    ?.coverage?.enabled;
}

function getTestTimeout(config: unknown): number | undefined {
  return (config as { test?: { testTimeout?: number } }).test?.testTimeout;
}

describe("Vitest configuration helpers", () => {
  test("keeps the default shared Vitest lane coverage-free", () => {
    const config = defineCxVitestConfig({
      include: [
        "tests/unit/**/*.test.ts",
        "tests/contracts/**/*.test.ts",
        "tests/config/**/*.test.ts",
        "tests/mcp/**/*.test.ts",
        "tests/cli/mcp*.test.ts",
      ],
      reportsDirectory: "./coverage/vitest",
    });

    expect(getCoverageDirectory(config)).toBe("./coverage/vitest");
    expect(isCoverageEnabled(config)).toBe(false);
    expect(getTestTimeout(config)).toBe(15_000);
    expect(getIncludePatterns(config)).toEqual([
      "tests/unit/**/*.test.ts",
      "tests/contracts/**/*.test.ts",
      "tests/config/**/*.test.ts",
      "tests/mcp/**/*.test.ts",
      "tests/cli/mcp*.test.ts",
    ]);
  });

  test("merges focused MCP cockpit overrides on top of the shared base", () => {
    const config = defineCxVitestConfig(
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

    expect(getCoverageDirectory(config)).toBe("./coverage/vitest-mcp");
    expect(isCoverageEnabled(config)).toBe(false);
    expect(getTestTimeout(config)).toBe(15_000);
    expect(getIncludePatterns(config)).toEqual([
      "tests/mcp/**/*.test.ts",
      "tests/cli/mcp*.test.ts",
      "tests/unit/mcp*.test.ts",
      "tests/unit/doctorMcpReport.test.ts",
      "tests/contracts/mcpPolicy.contract.test.ts",
    ]);
    expect((config as { test?: { name?: string } }).test?.name).toBe(
      "mcp-cockpit",
    );
  });

  test("supports a narrower adversarial MCP cockpit on the same shared base", () => {
    const config = defineCxVitestConfig(
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

    expect(getCoverageDirectory(config)).toBe(
      "./coverage/vitest-mcp-adversarial",
    );
    expect(getTestTimeout(config)).toBe(15_000);
    expect(getIncludePatterns(config)).toEqual([
      "tests/mcp/server.run.test.ts",
      "tests/mcp/toolRuntime.adversarial.test.ts",
    ]);
    expect((config as { test?: { name?: string } }).test?.name).toBe(
      "mcp-adversarial-cockpit",
    );
  });

  test("allows explicit coverage opt-in for reporting lanes", () => {
    const config = defineCxVitestConfig({
      include: ["tests/**/*.test.ts"],
      reportsDirectory: "./coverage/vitest",
      coverageEnabled: true,
    });

    expect(getCoverageDirectory(config)).toBe("./coverage/vitest");
    expect(isCoverageEnabled(config)).toBe(true);
    expect(getTestTimeout(config)).toBe(15_000);
  });
});
