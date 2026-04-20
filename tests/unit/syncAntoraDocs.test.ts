// test-lane: unit

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  DEFAULT_ANTORA_PAGES_ROOT,
  syncAntoraDocs,
} from "../../scripts/sync-antora-docs.js";

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../..",
);

describe("sync-antora-docs.js", () => {
  test("projects only root markdown companions into the Antora repository surface", async () => {
    const result = await syncAntoraDocs({ repoRoot: ROOT });

    expect(result.pageCount).toBe(2);

    const generatedChangelog = await fs.readFile(
      path.join(ROOT, DEFAULT_ANTORA_PAGES_ROOT, "root/changelog.adoc"),
      "utf8",
    );
    const generatedReadme = await fs.readFile(
      path.join(ROOT, DEFAULT_ANTORA_PAGES_ROOT, "root/readme.adoc"),
      "utf8",
    );

    expect(generatedChangelog).toContain("Source companion: `CHANGELOG.md`");
    expect(generatedReadme).toContain("Source companion: `README.md`");
    const staticReferenceDoc = await fs.readFile(
      path.join(ROOT, DEFAULT_ANTORA_PAGES_ROOT, "docs/agent_integration.adoc"),
      "utf8",
    );
    expect(staticReferenceDoc).toContain("= Agent Integration Guide");
  });
});
