// test-lane: unit
import { describe, expect, test } from "bun:test";
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

function getBunAlias(config: unknown): string | undefined {
  const alias = (config as { resolve?: { alias?: Record<string, string> } })
    .resolve?.alias;
  return alias?.["bun:test"];
}

describe("Vitest configuration helpers", () => {
  test("builds the default coverage lane with Bun test compatibility", () => {
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

    expect(getBunAlias(config)).toContain("bun-test-shim.ts");
    expect(getCoverageDirectory(config)).toBe("./coverage/vitest");
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

    expect(getBunAlias(config)).toContain("bun-test-shim.ts");
    expect(getCoverageDirectory(config)).toBe("./coverage/vitest-mcp");
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

    expect(getBunAlias(config)).toContain("bun-test-shim.ts");
    expect(getCoverageDirectory(config)).toBe(
      "./coverage/vitest-mcp-adversarial",
    );
    expect(getIncludePatterns(config)).toEqual([
      "tests/mcp/server.run.test.ts",
      "tests/mcp/toolRuntime.adversarial.test.ts",
    ]);
    expect((config as { test?: { name?: string } }).test?.name).toBe(
      "mcp-adversarial-cockpit",
    );
  });
});
