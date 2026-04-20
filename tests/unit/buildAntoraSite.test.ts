// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildAntoraSite } from "../../scripts/build-antora-site.js";

async function makeFixtureRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "cx-antora-site-"));
}

describe("build-antora-site.js", () => {
  test("builds the curated Antora documentation site", async () => {
    const root = await makeFixtureRoot();
    const siteRoot = path.join(root, "antora-site");

    const result = await buildAntoraSite({ toDir: siteRoot });

    expect(result.siteRoot).toBe(siteRoot);
    const index = await fs.readFile(result.indexPath, "utf8");
    expect(index).toContain("CX Documentation");
    expect(index).toContain("Curated Documentation Surface");
  });
});
