// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { assemblePagesSite } from "../../scripts/assemble-pages-site.js";

async function makeFixtureRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "cx-pages-site-"));
}

describe("assemble-pages-site.js", () => {
  test("stages a unified site tree with schemas and coverage", async () => {
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
      path.join(schemasDir, "manifest-v7.schema.json"),
      '{"$id":"https://example.invalid/manifest-v7.schema.json"}\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(schemasDir, "manifest-v8.schema.json"),
      '{"$id":"https://example.invalid/manifest-v8.schema.json"}\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(schemasDir, "json-section-output-v1.schema.json"),
      '{"$id":"https://example.invalid/json-section-output-v1.schema.json"}\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(schemasDir, "shared-handover-v1.schema.json"),
      '{"$id":"https://example.invalid/shared-handover-v1.schema.json"}\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(schemasDir, "shared-handover-v2.schema.json"),
      '{"$id":"https://example.invalid/shared-handover-v2.schema.json"}\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(coverageDir, "index.html"),
      "<html><body>coverage</body></html>\n",
      "utf8",
    );

    const result = await assemblePagesSite({
      siteRoot,
      schemasDir,
      coverageDir,
    });

    expect(result.schemaNames).toEqual([
      "cx-config-v1.schema.json",
      "json-section-output-v1.schema.json",
      "manifest-v7.schema.json",
      "manifest-v8.schema.json",
      "shared-handover-v1.schema.json",
      "shared-handover-v2.schema.json",
    ]);
    expect(result.hasCoverage).toBe(true);
    expect(result.coverageDir).toBe(path.join(siteRoot, "coverage"));
    expect(result.docsDir).toBe(path.join(siteRoot, "docs"));

    const rootIndex = await fs.readFile(
      path.join(siteRoot, "index.html"),
      "utf8",
    );
    const docsIndex = await fs.readFile(
      path.join(siteRoot, "docs", "index.html"),
      "utf8",
    );
    const versionedDocsIndex = await fs.readFile(
      path.join(siteRoot, "docs", "cx", "0.4", "index.html"),
      "utf8",
    );
    const schemasIndex = await fs.readFile(
      path.join(siteRoot, "schemas", "index.html"),
      "utf8",
    );
    const coverageIndex = await fs.readFile(
      path.join(siteRoot, "coverage", "index.html"),
      "utf8",
    );

    expect(rootIndex).toContain('href="docs/"');
    expect(rootIndex).toContain('href="schemas/"');
    expect(rootIndex).toContain('href="coverage/"');
    expect(docsIndex).toContain('location="cx/0.4/"');
    expect(versionedDocsIndex).toContain("CX Documentation");
    expect(schemasIndex).toContain("cx-config-v1.schema.json");
    expect(schemasIndex).toContain("json-section-output-v1.schema.json");
    expect(schemasIndex).toContain("manifest-v7.schema.json");
    expect(schemasIndex).toContain("manifest-v8.schema.json");
    expect(schemasIndex).toContain("shared-handover-v1.schema.json");
    expect(schemasIndex).toContain("shared-handover-v2.schema.json");
    expect(coverageIndex).toContain("coverage");
  });

  test("publishes schemas cleanly when coverage is absent", async () => {
    const root = await makeFixtureRoot();
    const schemasDir = path.join(root, "schemas");
    const siteRoot = path.join(root, "site");

    await fs.mkdir(schemasDir, { recursive: true });
    await fs.writeFile(
      path.join(schemasDir, "cx-config-v1.schema.json"),
      '{"$id":"https://example.invalid/cx-config-v1.schema.json"}\n',
      "utf8",
    );

    const result = await assemblePagesSite({
      siteRoot,
      schemasDir,
      coverageDir: path.join(root, "missing-coverage"),
    });

    expect(result.hasCoverage).toBe(false);
    expect(result.coverageDir).toBeNull();
    expect(result.docsDir).toBe(path.join(siteRoot, "docs"));

    const rootIndex = await fs.readFile(
      path.join(siteRoot, "index.html"),
      "utf8",
    );
    const docsIndex = await fs.readFile(
      path.join(siteRoot, "docs", "index.html"),
      "utf8",
    );
    const versionedDocsIndex = await fs.readFile(
      path.join(siteRoot, "docs", "cx", "0.4", "index.html"),
      "utf8",
    );
    expect(rootIndex).toContain('href="docs/"');
    expect(docsIndex).toContain('location="cx/0.4/"');
    expect(versionedDocsIndex).toContain("CX Documentation");
    expect(rootIndex).toContain("does not include a coverage report");
    await expect(
      fs.access(path.join(siteRoot, "coverage", "index.html")),
    ).rejects.toBeDefined();
  });
});
