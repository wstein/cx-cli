// test-lane: unit

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function makeCoverageFixture(lineHits: number[]): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-coverage-summary-"));
  await fs.mkdir(path.join(root, "coverage"), { recursive: true });
  await fs.mkdir(path.join(root, "src"), { recursive: true });

  const sourceLines = lineHits.map(
    (_, index) => `export const value${index + 1} = ${index + 1};`,
  );
  await fs.writeFile(
    path.join(root, "src", "app.ts"),
    `${sourceLines.join("\n")}\n`,
  );

  const lcov = [
    "TN:",
    "SF:src/app.ts",
    ...lineHits.map((hit, index) => `DA:${index + 1},${hit}`),
    "end_of_record",
    "",
  ].join("\n");
  await fs.writeFile(path.join(root, "coverage", "lcov.info"), lcov, "utf8");

  return root;
}

async function makeDuplicateRecordFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-coverage-merge-"));
  await fs.mkdir(path.join(root, "coverage"), { recursive: true });
  await fs.mkdir(path.join(root, "src"), { recursive: true });

  await fs.writeFile(
    path.join(root, "src", "app.ts"),
    `${["export const alpha = 1;", "export const beta = 2;"].join("\n")}\n`,
  );

  const lcov = [
    "TN:",
    "SF:src/app.ts",
    "DA:1,1",
    "DA:2,0",
    "end_of_record",
    "TN:",
    "SF:src/app.ts",
    "DA:1,0",
    "DA:2,1",
    "end_of_record",
    "",
  ].join("\n");
  await fs.writeFile(path.join(root, "coverage", "lcov.info"), lcov, "utf8");

  return root;
}

describe("coverage-summary.js", () => {
  test("fails when overall coverage drops below the minimum threshold", async () => {
    const root = await makeCoverageFixture([1, 1, 0, 0, 0]);

    const result = spawnSync(
      "node",
      [path.join(ROOT, "scripts", "coverage-summary.js")],
      {
        cwd: root,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Coverage gate failed");
    expect(
      await fs.stat(path.join(root, "coverage", "COVERAGE.md")),
    ).toBeTruthy();
  });

  test("passes when overall coverage meets the minimum threshold", async () => {
    const root = await makeCoverageFixture([1, 1, 1, 1, 0]);

    const result = spawnSync(
      "node",
      [path.join(ROOT, "scripts", "coverage-summary.js")],
      {
        cwd: root,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Coverage: 80.00%");
    expect(
      await fs.stat(path.join(root, "coverage", "COVERAGE.md")),
    ).toBeTruthy();
  });

  test("merges duplicate LCOV source-file records before calculating totals", async () => {
    const root = await makeDuplicateRecordFixture();

    const result = spawnSync(
      "node",
      [path.join(ROOT, "scripts", "coverage-summary.js")],
      {
        cwd: root,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Coverage: 100.00% (2/2)");

    const report = await fs.readFile(
      path.join(root, "coverage", "COVERAGE.md"),
      "utf8",
    );
    expect(report).toContain("- Overall: 100.00% (2/2 lines)");
  });
});
