// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const REPOSITORY_DOCS_DIR = path.join(
  ROOT,
  "docs/modules/ROOT/pages/repository/docs",
);
const DOC_BLOB_PATTERN =
  /https:\/\/github\.com\/[^\s)"']+\/blob\/main\/docs(?:\/|\b)/;

async function collectAdocFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectAdocFiles(target)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".adoc")) {
      results.push(target);
    }
  }

  return results.sort();
}

describe("repository reference link contract", () => {
  test("repository reference pages do not link back to docs blob URLs", async () => {
    const adocFiles = await collectAdocFiles(REPOSITORY_DOCS_DIR);
    const violations: string[] = [];

    for (const file of adocFiles) {
      const text = await fs.readFile(file, "utf8");
      if (DOC_BLOB_PATTERN.test(text)) {
        violations.push(path.relative(ROOT, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
