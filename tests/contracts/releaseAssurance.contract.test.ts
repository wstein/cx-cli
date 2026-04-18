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

async function readPackageJson(): Promise<{
  scripts?: Record<string, string>;
}> {
  return JSON.parse(await readText("package.json")) as {
    scripts?: Record<string, string>;
  };
}

describe("release assurance contract", () => {
  test("package scripts expose delegated ci assurance entry points", async () => {
    const pkg = await readPackageJson();
    const scripts = pkg.scripts ?? {};

    expect(scripts["ci:smoke:repomix-version"]).toBe(
      "node scripts/repomix-version-smoke.js",
    );
    expect(scripts["ci:smoke:bundle-transition"]).toBe(
      "node scripts/bundle-transition-smoke.js",
    );
    expect(scripts["ci:assurance:release-integrity"]).toBe(
      "node scripts/release-assurance-smoke.js",
    );
    expect(scripts["ci:assurance:reproducibility"]).toBe(
      "node scripts/reproducibility-check.js",
    );
  });

  test("certify delegates through ci assurance entry points", async () => {
    const pkg = await readPackageJson();
    const certify = pkg.scripts?.certify ?? "";

    expect(certify).toContain("bun run ci:test:contracts");
    expect(certify).toContain("bun run ci:smoke:repomix-version");
    expect(certify).toContain("bun run ci:smoke:bundle-transition");
    expect(certify).toContain("bun run ci:assurance:release-integrity");
    expect(certify).toContain("bun run ci:assurance:reproducibility");
  });

  test("workflow calls the delegated ci assurance scripts", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("bun run ci:smoke:repomix-version");
    expect(workflow).toContain(
      'bun run ci:smoke:bundle-transition -- --transition "$' +
        "{{ matrix.transition }}" +
        '"',
    );
    expect(workflow).toContain("bun run ci:assurance:release-integrity");
    expect(workflow).toContain("bun run ci:assurance:reproducibility");
  });
});
