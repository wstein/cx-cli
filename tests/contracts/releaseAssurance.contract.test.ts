// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

function squashWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function readPackageJson(): Promise<{
  scripts?: Record<string, string>;
}> {
  return JSON.parse(await readText("package.json")) as {
    scripts?: Record<string, string>;
  };
}

describe("release assurance contract", () => {
  test("release workflow finalizes from version tags and verifies certified develop CI", async () => {
    const workflow = await readText(".github/workflows/release.yml");

    expect(workflow).toContain("push:");
    expect(workflow).toContain('      - "v*"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain(
      "Existing release tag (vX.Y.Z) to finalize again.",
    );
    expect(workflow).toContain(
      "git fetch origin develop:refs/remotes/origin/develop --force",
    );
    expect(workflow).toContain('git branch -r --contains "$head_sha"');
    expect(workflow).toContain('.name=="CI" and .head_branch=="develop"');
    expect(workflow).toContain("Tagged commit $head_sha has not passed");
  });

  test("release workflow pins Bun setup to the declared minimum runtime", async () => {
    const workflow = await readText(".github/workflows/release.yml");

    expect(workflow).toContain("BUN_MIN_VERSION: 1.3.11");
    expect(workflow).toContain("bun-version: $" + "{{ env.BUN_MIN_VERSION }}");
  });

  test("package scripts expose delegated ci assurance entry points", async () => {
    const pkg = await readPackageJson();
    const scripts = pkg.scripts ?? {};

    expect(scripts["ci:smoke:repomix-reference-oracle"]).toBe(
      "node scripts/repomix-reference-oracle-smoke.js",
    );
    expect(scripts["ci:smoke:adapter-version"]).toBeUndefined();
    expect(scripts["ci:smoke:adapter-dual-oracle"]).toBeUndefined();
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
    expect(certify).toContain("bun run ci:smoke:repomix-reference-oracle");
    expect(certify).toContain("bun run ci:smoke:bundle-transition");
    expect(certify).toContain("bun run ci:assurance:release-integrity");
    expect(certify).toContain("bun run ci:assurance:reproducibility");
  });

  test("workflow calls the delegated ci assurance scripts", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("bun run ci:smoke:repomix-reference-oracle");
    expect(workflow).not.toContain("ci:smoke:adapter-version");
    expect(workflow).not.toContain("ci:smoke:adapter-dual-oracle");
    expect(workflow).toContain("bun run ci:notes:governance");
    expect(workflow).toContain(
      'bun run ci:smoke:bundle-transition -- --transition "$' +
        "{{ matrix.transition }}" +
        '"',
    );
    expect(workflow).toContain("bun run ci:assurance:release-integrity");
    expect(workflow).toContain("bun run ci:assurance:reproducibility");
  });

  test("release workflow publishes tarball, integrity, and formula assets", async () => {
    const workflow = await readText(".github/workflows/release.yml");

    expect(workflow).toContain("Stage release integrity file");
    expect(workflow).toContain(
      "cp dist/release-integrity.json tarball-artifacts/release-integrity.json",
    );
    expect(workflow).toContain("release-assets:");
    expect(workflow).toContain("Render GitHub release body");
    expect(workflow).toContain(".github/release-body-template.md");
    expect(workflow).toContain("Publish GitHub release assets");
    expect(workflow).toContain("uses: softprops/action-gh-release@v2");
    expect(workflow).toContain(
      "tag_name: $" + "{{ needs.gate.outputs.release_tag }}",
    );
    expect(workflow).toContain("body_path: tarball-artifacts/release-body.md");
    expect(workflow).toContain("tarball-artifacts/*.tgz");
    expect(workflow).toContain("tarball-artifacts/release-integrity.json");
    expect(workflow).toContain("tarball-artifacts/cx-cli.rb");
  });

  test("release workflow fast-forwards main after successful publish", async () => {
    const workflow = await readText(".github/workflows/release.yml");

    expect(workflow).toContain("promote-main:");
    expect(workflow).toContain("Fast-forward main to released commit");
    expect(workflow).toContain('git merge --ff-only "');
    expect(workflow).toContain("needs.gate.outputs.release_sha");
    expect(workflow).toContain("git push origin main");
  });

  test("release checklist names the reference-oracle smoke lane instead of fork-era smoke lanes", async () => {
    const checklist = await readText(
      "docs/modules/ROOT/pages/release/checklist.adoc",
    );
    const normalized = squashWhitespace(checklist);

    expect(normalized).toContain(
      "official Repomix reference-oracle smoke lane",
    );
    expect(normalized).not.toContain("Repomix fork compatibility smoke");
    expect(normalized).not.toContain("dual-oracle");
  });
});
