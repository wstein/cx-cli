// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function listMarkdownFiles(
  root: string,
  current = "",
): Promise<string[]> {
  const dir = path.join(root, current);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(current, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listMarkdownFiles(root, relativePath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(relativePath);
    }
  }

  return results.sort();
}

describe("docs markdown boundary", () => {
  test("docs tree keeps only the top-level README as markdown", async () => {
    const markdownFiles = await listMarkdownFiles(path.join(ROOT, "docs"));

    expect(markdownFiles).toEqual(["README.md"]);
  });
});
