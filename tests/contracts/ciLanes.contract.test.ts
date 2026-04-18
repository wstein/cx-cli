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

  test("package scripts use deterministic file-list discovery via test-lane.js", async () => {
    const pkgRaw = await readText("package.json");
    const pkg = JSON.parse(pkgRaw) as {
      scripts?: Record<string, string>;
    };

    const scripts = pkg.scripts ?? {};
    expect(scripts["test:all"]).toContain("node scripts/test-lane.js ./tests");
    expect(scripts["test:contracts"]).toContain(
      "node scripts/test-lane.js ./tests/contracts",
    );
    expect(scripts["ci:test:all"]).toBe("bun run test:all");
    expect(scripts["ci:test:contracts"]).toBe("bun run test:contracts");

    // shell find must not survive in any test-discovery script
    expect(scripts["test:all"]).not.toContain("find ./tests");
    expect(scripts["test:contracts"]).not.toContain("find ./tests");
  });

  test("CI reproducibility job delegates to scripts/reproducibility-check.js", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("node scripts/reproducibility-check.js");
    // inline hash-capture steps must not remain in the workflow
    expect(workflow).not.toContain("sha256sum");
    expect(workflow).not.toContain("build1.sha256");
  });
});
