// test-lane: unit

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  DEFAULT_ANTORA_NAV_PARTIAL,
  DEFAULT_ANTORA_PAGES_ROOT,
  syncAntoraDocs,
} from "../../scripts/sync-antora-docs.js";

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../..",
);

describe("sync-antora-docs.js", () => {
  test("projects markdown docs into the Antora repository surface", async () => {
    const result = await syncAntoraDocs({ repoRoot: ROOT });

    expect(result.pageCount).toBeGreaterThan(20);

    const generatedReadme = await fs.readFile(
      path.join(ROOT, DEFAULT_ANTORA_PAGES_ROOT, "docs/readme.adoc"),
      "utf8",
    );
    const generatedChangelog = await fs.readFile(
      path.join(ROOT, DEFAULT_ANTORA_PAGES_ROOT, "root/changelog.adoc"),
      "utf8",
    );
    const navPartial = await fs.readFile(
      path.join(ROOT, DEFAULT_ANTORA_NAV_PARTIAL),
      "utf8",
    );

    expect(generatedReadme).toContain("Source companion: `docs/README.md`");
    expect(generatedReadme).toContain('href="../root/changelog/"');
    expect(generatedChangelog).toContain("Source companion: `CHANGELOG.md`");
    expect(navPartial).toContain(
      "xref:repository/docs/readme.adoc[docs/README.md]",
    );
    expect(navPartial).toContain(
      "xref:repository/root/changelog.adoc[CHANGELOG.md]",
    );
  });
});
