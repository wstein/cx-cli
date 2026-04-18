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

describe("CI lanes contract", () => {
  test("workflow test lanes invoke script-backed Bun commands", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("run: bun run ci:test:all");
    expect(workflow).toContain("run: bun run ci:test:contracts");
    expect(workflow).not.toContain("bun test tests --timeout");
    expect(workflow).not.toContain("bun test tests/contracts --timeout");
  });

  test("package scripts use deterministic file-list discovery", async () => {
    const pkgRaw = await readText("package.json");
    const pkg = JSON.parse(pkgRaw) as {
      scripts?: Record<string, string>;
    };

    const scripts = pkg.scripts ?? {};
    expect(scripts["ci:test:all"]).toContain("find ./tests -type f -name '*.test.ts'");
    expect(scripts["ci:test:contracts"]).toContain(
      "find ./tests/contracts -type f -name '*.test.ts'",
    );
  });
});
