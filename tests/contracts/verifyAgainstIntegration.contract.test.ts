// test-lane: contract

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  runVerifyAgainstPolicyCli,
  validateAgainstDirVerifyPolicy,
} from "../../scripts/verify-against-policy.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

function parseAuditRows(document: string): Array<{
  file: string;
  testName: string;
  rationale: string;
  counterpart: string;
}> {
  return document
    .split("\n")
    .filter((line) => line.startsWith("| `tests/"))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .map((cells) => ({
      file: cells[1] ?? "",
      testName: cells[2] ?? "",
      rationale: cells[3] ?? "",
      counterpart: cells[4] ?? "",
    }));
}

describe("verify --against integration audit", () => {
  test("all runVerifyCommand --against tests include an integration rationale tag", () => {
    const { entries, missingJustifications } = validateAgainstDirVerifyPolicy();
    expect(entries.length).toBeGreaterThan(0);
    expect(missingJustifications).toEqual([]);
  });

  test("audit document covers every runVerifyCommand --against test", async () => {
    const { entries } = validateAgainstDirVerifyPolicy();
    const audit = await readText("tests/VERIFY_AGAINST_AUDIT.md");

    for (const entry of entries) {
      expect(audit).toContain(
        `| \`${entry.relativePath}\` | \`${entry.testName}\` |`,
      );
    }
  });

  test("audit rows include explicit injected seam counterpart references", async () => {
    const audit = await readText("tests/VERIFY_AGAINST_AUDIT.md");
    expect(audit).toContain("| Injected seam counterpart |");

    const rows = parseAuditRows(audit);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.counterpart).toContain("`tests/unit/");
      const pathMatch = row.counterpart.match(/`(tests\/unit\/[^`]+)`/);
      expect(pathMatch).not.toBeNull();
      const counterpartFile = pathMatch?.[1];
      expect(counterpartFile).toBeDefined();
      if (counterpartFile) {
        await fs.access(path.join(ROOT, counterpartFile));
      }
      expect(row.counterpart).toContain("(`");
      expect(row.counterpart).toContain("`)");
    }
  });

  test("policy script emits a CI-readable JSON report for automation bots", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-verify-report-"),
    );
    const reportPath = path.join(tempDir, "verify-against-policy-report.json");
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = runVerifyAgainstPolicyCli(
      ["--format", "json", "--output", reportPath],
      {
        stdout: (message) => {
          stdout.push(message);
          return true;
        },
        stderr: (message) => {
          stderr.push(message);
          return true;
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);

    const stdoutPayload = JSON.parse(stdout.join("")) as {
      ok?: boolean;
      summary?: { againstDirTestCount?: number };
    };
    const filePayload = JSON.parse(await fs.readFile(reportPath, "utf8")) as {
      ok?: boolean;
      summary?: { againstDirTestCount?: number };
    };

    expect(stdoutPayload.ok).toBe(true);
    expect(filePayload.ok).toBe(true);
    expect(stdoutPayload.summary?.againstDirTestCount).toBeGreaterThan(0);
    expect(filePayload.summary?.againstDirTestCount).toBe(
      stdoutPayload.summary?.againstDirTestCount,
    );
  });
});
