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

describe("Pages publish contract", () => {
  test("pages workflow publishes from successful main CI runs", async () => {
    const workflow = await readText(".github/workflows/publish-schemas.yml");

    expect(workflow).toContain("name: Publish Pages");
    expect(workflow).toContain('workflows: ["CI"]');
    expect(workflow).toContain("types: [completed]");
    expect(workflow).toContain("run_pages_publish");
    expect(workflow).toContain("run_release_publish");
    expect(workflow).toContain(
      'if [ "$' +
        "{{ github.event.workflow_run.conclusion }}" +
        '" != "success" ]; then',
    );
    expect(workflow).toContain(
      'if [ "$' +
        "{{ github.event.workflow_run.head_branch }}" +
        '" = "main" ]; then',
    );
    expect(workflow).toContain("Generate coverage report");
    expect(workflow).toContain("run: bun run ci:test:coverage");
    expect(workflow).toContain("run: bun run pages:build");
    expect(workflow).toContain("publish_branch: gh-pages");
    expect(workflow).toContain("publish_dir: site");
  });

  test("release asset mirroring stays separate from automatic Pages publishing", async () => {
    const workflow = await readText(".github/workflows/publish-schemas.yml");

    expect(workflow).toContain("publish-release:");
    expect(workflow).toContain(
      "if: needs.gate.outputs.run_release_publish == 'true'",
    );
    expect(workflow).toContain(
      "tag_name=$(git tag --points-at HEAD --list 'v*'",
    );
  });

  test("package scripts expose the shared Pages builder", async () => {
    const pkg = JSON.parse(await readText("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts?.["pages:build"]).toBe(
      "node scripts/assemble-pages-site.js",
    );
  });
});
