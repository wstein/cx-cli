// test-lane: contract

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { assemblePagesSite } from "../../scripts/assemble-pages-site.js";

const SLOW_PAGES_TIMEOUT_MS = 20_000;

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

async function makeFixtureRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "cx-pages-contract-"));
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
    expect(workflow).toContain("Smoke-check staged Pages site");
    expect(workflow).toContain("continue-on-error: true");
    expect(workflow).toContain("run: bun run pages:smoke");
    expect(workflow).toContain("publish_branch: gh-pages");
    expect(workflow).toContain("publish_dir: dist/site");
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

    expect(pkg.scripts?.["docs:antora:sync"]).toBe(
      "node scripts/sync-antora-docs.js",
    );
    expect(pkg.scripts?.["docs:antora:build"]).toBe(
      "node scripts/build-antora-site.js",
    );
    expect(pkg.scripts?.["pages:build"]).toBe(
      "node scripts/assemble-pages-site.js",
    );
    expect(pkg.scripts?.["pages:smoke"]).toBe(
      "node scripts/check-pages-site.js",
    );
  });

  test("root Pages index links docs, schemas, and coverage surfaces", {
    timeout: SLOW_PAGES_TIMEOUT_MS,
  }, async () => {
    const root = await makeFixtureRoot();
    const schemasDir = path.join(root, "schemas");
    const coverageDir = path.join(root, "coverage", "vitest");
    const siteRoot = path.join(root, "site");

    await fs.mkdir(schemasDir, { recursive: true });
    await fs.mkdir(coverageDir, { recursive: true });
    await fs.writeFile(
      path.join(schemasDir, "cx-config-v1.schema.json"),
      '{"$id":"https://example.invalid/cx-config-v1.schema.json"}\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(coverageDir, "index.html"),
      "<html><body>coverage</body></html>\n",
      "utf8",
    );

    await assemblePagesSite({
      siteRoot,
      schemasDir,
      coverageDir,
    });

    const rootIndex = await fs.readFile(
      path.join(siteRoot, "index.html"),
      "utf8",
    );
    expect(rootIndex).toContain('href="docs/"');
    expect(rootIndex).toContain('href="schemas/"');
    expect(rootIndex).toContain('href="coverage/"');
  });

  test("pages smoke workflow validates the staged site tree", async () => {
    const workflow = await readText(".github/workflows/pages-smoke.yml");

    expect(workflow).toContain("name: Pages Smoke");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("Generate coverage report");
    expect(workflow).toContain("run: bun run ci:test:coverage");
    expect(workflow).toContain("run: bun run pages:build");
    expect(workflow).toContain("run: bun run pages:smoke");
    expect(workflow).toContain("docs/**");
    expect(workflow).toContain("docs/ui/**");
    expect(workflow).toContain("scripts/build-antora-site.js");
    expect(workflow).toContain("scripts/sync-antora-docs.js");
  });

  test("docs folder keeps a single markdown guide and points readers to the Antora front door", async () => {
    const docsFiles = await fs.readdir(path.join(ROOT, "docs"));
    const markdownFiles = docsFiles.filter((entry) => entry.endsWith(".md"));
    const docsGuide = await readText("docs/README.md");

    expect(markdownFiles).toEqual(["README.md"]);
    expect(docsGuide).toContain(
      "`docs/` now holds the canonical Antora component",
    );
    expect(docsGuide).toContain("arc42 as its spine");
    expect(docsGuide).toContain("docs/modules/ROOT/pages/index.adoc");
    expect(docsGuide).toContain("https://wstein.github.io/cx-cli/docs/");
  });
});
