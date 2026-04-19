// test-lane: contract
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateAgainstDirVerifyPolicy } from "../../scripts/verify-against-policy.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
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
});
