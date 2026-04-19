// test-lane: contract
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

describe("MCP Vitest cockpit contract", () => {
  test("package scripts expose focused MCP Vitest commands", async () => {
    const pkgRaw = await readText("package.json");
    const pkg = JSON.parse(pkgRaw) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};

    expect(scripts["test:vitest:mcp"]).toBe(
      "vitest run --config vitest.mcp.config.ts",
    );
    expect(scripts["test:vitest:mcp:ui"]).toBe(
      "vitest --config vitest.mcp.config.ts --ui --coverage --open=false",
    );
    expect(scripts["coverage:vitest:mcp"]).toBe(
      "vitest run --config vitest.mcp.config.ts --coverage",
    );
  });

  test("MCP cockpit config targets MCP-heavy suites and separate coverage output", async () => {
    const config = await readText("vitest.mcp.config.ts");

    expect(config).toContain("defineCxVitestConfig");
    expect(config).toContain('"tests/mcp/**/*.test.ts"');
    expect(config).toContain('"tests/cli/mcp*.test.ts"');
    expect(config).toContain('"tests/unit/mcp*.test.ts"');
    expect(config).toContain('"tests/unit/doctorMcpReport.test.ts"');
    expect(config).toContain('"tests/contracts/mcpPolicy.contract.test.ts"');
    expect(config).toContain('reportsDirectory: "./coverage/vitest-mcp"');
    expect(config).toContain('name: "mcp-cockpit"');
  });

  test("operator docs make the MCP cockpit discoverable", async () => {
    const readme = await readText("README.md");
    const manual = await readText("docs/MANUAL.md");
    const agentIntegration = await readText("docs/AGENT_INTEGRATION.md");
    const testsGuide = await readText("tests/README.md");

    expect(readme).toContain("bun run test:vitest:mcp");
    expect(readme).toContain("bun run test:vitest:mcp:ui");
    expect(manual).toContain("bun run test:vitest:mcp");
    expect(manual).toContain("bun run test:vitest:mcp:ui");
    expect(agentIntegration).toContain("## MCP Test And Debug Cockpit");
    expect(agentIntegration).toContain("bun run test:vitest:mcp:ui");
    expect(agentIntegration).toContain("import-graph");
    expect(testsGuide).toContain("## Focused MCP Cockpit");
    expect(testsGuide).toContain("bun run test:vitest:mcp");
  });
});
