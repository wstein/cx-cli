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

async function readPackageJson(): Promise<{
  scripts?: Record<string, string>;
}> {
  return JSON.parse(await readText("package.json")) as {
    scripts?: Record<string, string>;
  };
}

describe("release assurance contract", () => {
  test("release workflow gate blocks publish when upstream CI failed", async () => {
    const workflow = await readText(".github/workflows/release.yml");

    expect(workflow).toContain(
      'if [ "$' +
        "{{ github.event.workflow_run.conclusion }}" +
        '" != "success" ]; then',
    );
    expect(workflow).toContain('echo "run_release=false" >> "$GITHUB_OUTPUT"');
  });

  test("release workflow pins Bun setup to the declared minimum runtime", async () => {
    const workflow = await readText(".github/workflows/release.yml");

    expect(workflow).toContain("BUN_MIN_VERSION: 1.3.11");
    expect(workflow).toContain("bun-version: $" + "{{ env.BUN_MIN_VERSION }}");
  });

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
    expect(scripts["ci:notes:governance"]).toBe(
      "node scripts/notes-governance.js",
    );
  });

  test("certify delegates through ci assurance entry points", async () => {
    const pkg = await readPackageJson();
    const certify = pkg.scripts?.certify ?? "";

    expect(certify).toContain("bun run ci:notes:governance");
    expect(certify).toContain("bun run ci:test:contracts");
    expect(certify).toContain("bun run ci:smoke:repomix-version");
    expect(certify).toContain("bun run ci:smoke:bundle-transition");
    expect(certify).toContain("bun run ci:assurance:release-integrity");
    expect(certify).toContain("bun run ci:assurance:reproducibility");
  });

  test("workflow calls the delegated ci assurance scripts", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("bun run ci:smoke:repomix-version");
    expect(workflow).toContain("bun run ci:notes:governance");
    expect(workflow).toContain(
      'bun run ci:smoke:bundle-transition -- --transition "$' +
        "{{ matrix.transition }}" +
        '"',
    );
    expect(workflow).toContain("bun run ci:assurance:release-integrity");
    expect(workflow).toContain("bun run ci:assurance:reproducibility");
  });
});
