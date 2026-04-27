// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

const IMPORT_REGEX =
  /import\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?["']([^"']+)["']/gu;

async function pathExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

async function resolveImport(fromFile: string, specifier: string) {
  if (!specifier.startsWith(".")) {
    return null;
  }
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    base.replace(/\.js$/u, ".ts"),
    `${base}.ts`,
    path.join(base, "index.ts"),
  ];
  for (const candidate of candidates) {
    if (
      candidate.startsWith(path.join(process.cwd(), "src")) &&
      (await pathExists(candidate))
    ) {
      return path.relative(process.cwd(), candidate).replaceAll(path.sep, "/");
    }
  }
  return null;
}

async function readImports(relativeFile: string): Promise<string[]> {
  const absoluteFile = path.join(process.cwd(), relativeFile);
  const source = await fs.readFile(absoluteFile, "utf8");
  const imports: string[] = [];
  for (const match of source.matchAll(IMPORT_REGEX)) {
    const resolved = await resolveImport(absoluteFile, match[1] ?? "");
    if (resolved !== null) {
      imports.push(resolved);
    }
  }
  return imports;
}

async function collectReachable(seed: string): Promise<Set<string>> {
  const reachable = new Set<string>();
  const queue = [seed];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || reachable.has(current)) {
      continue;
    }
    reachable.add(current);
    for (const next of await readImports(current)) {
      if (!reachable.has(next)) {
        queue.push(next);
      }
    }
  }
  return reachable;
}

describe("notes lint bundle boundary", () => {
  test("bundle import graph never reaches notes lint", async () => {
    const reachable = await collectReachable("src/cli/commands/bundle.ts");
    expect(reachable).not.toContain("src/notes/lint.ts");
  });
});
