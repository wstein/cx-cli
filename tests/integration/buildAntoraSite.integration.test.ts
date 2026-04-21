// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildAntoraSite } from "../../scripts/build-antora-site.js";

const SLOW_ANTORA_TIMEOUT_MS = 20_000;

async function makeFixtureRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "cx-antora-site-"));
}

describe("build-antora-site.js", () => {
  test("builds the curated Antora documentation site", {
    timeout: SLOW_ANTORA_TIMEOUT_MS,
  }, async () => {
    const root = await makeFixtureRoot();
    const siteRoot = path.join(root, "antora-site");

    const result = await buildAntoraSite({ toDir: siteRoot });

    expect(result.siteRoot).toBe(siteRoot);
    const index = await fs.readFile(result.indexPath, "utf8");
    expect(index).toContain("CX Documentation");
    expect(index).toContain("Curated Documentation Surface");
    expect(result.singleHtmlExports).toHaveLength(2);
    expect(result.singleHtmlExports[0]).toContain("manual.html");
    expect(result.singleHtmlExports[1]).toContain("architecture.html");
  });
});
