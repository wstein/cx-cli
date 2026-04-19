// test-lane: unit
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function makeCoverageSummaryFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-coverage-report-"));
  await fs.mkdir(path.join(root, "coverage", "vitest"), { recursive: true });
  await fs.writeFile(
    path.join(root, "coverage", "vitest", "coverage-summary.json"),
    JSON.stringify(
      {
        total: {
          lines: { total: 100, covered: 95, pct: 95 },
          functions: { total: 50, covered: 45, pct: 90 },
          branches: { total: 40, covered: 30, pct: 75 },
          statements: { total: 120, covered: 110, pct: 91.67 },
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  return root;
}

describe("coverage-report.js", () => {
  test("writes a markdown summary from Vitest json-summary output", async () => {
    const root = await makeCoverageSummaryFixture();

    const result = spawnSync(
      "node",
      [path.join(ROOT, "scripts", "coverage-report.js")],
      {
        cwd: root,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("# Coverage Summary");
    expect(result.stdout).toContain("| Lines | 95% | 95 / 100 |");

    const output = await fs.readFile(
      path.join(root, ".ci", "coverage-summary.md"),
      "utf8",
    );
    expect(output).toContain("| Branches | 75% | 30 / 40 |");
    expect(output).toContain("| Statements | 91.67% | 110 / 120 |");
  });
});
