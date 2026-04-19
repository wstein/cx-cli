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

async function readPackageVersion(): Promise<string> {
  const pkg = JSON.parse(await readText("package.json")) as { version: string };
  return pkg.version;
}

describe("v0.4.0 release readiness docs contract", () => {
  test("changelog and migration docs explain the v0.4.0 operating contract", async () => {
    const changelog = await readText("CHANGELOG.md");
    const migration = await readText("docs/MIGRATIONS/0.4.0.md");
    const docsIndex = await readText("docs/README.md");
    const packageVersion = await readPackageVersion();

    expect(packageVersion).toBe("0.4.0");

    expect(changelog).toContain("## [0.4.0] - 2026-04-19");
    expect(changelog).toContain("Track B generates hypotheses.");
    expect(changelog).toContain("Track A generates proofs.");
    expect(changelog).toContain("Vitest coverage is now the authoritative");
    expect(changelog).toContain("MCP remains an evolving integration surface");

    expect(migration).toContain("Migration Notes For 0.4.0");
    expect(migration).toContain("Track B generates hypotheses.");
    expect(migration).toContain("Track A generates proofs.");
    expect(migration).toContain("cx mcp catalog --json");
    expect(migration).toContain("bun run ci:notes:governance");

    expect(docsIndex).toContain("## What Changed In 0.4.0");
    expect(docsIndex).toContain("[../CHANGELOG.md](../CHANGELOG.md)");
    expect(docsIndex).toContain("[MIGRATIONS/0.4.0.md](./MIGRATIONS/0.4.0.md)");
  });
});
