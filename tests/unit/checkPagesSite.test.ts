// test-lane: unit
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assemblePagesSite } from "../../scripts/assemble-pages-site.js";
import { checkPagesSite } from "../../scripts/check-pages-site.js";

async function makeFixtureRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "cx-pages-smoke-"));
}

describe("check-pages-site.js", () => {
  test("passes for a staged site with schemas and coverage", async () => {
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

    await expect(checkPagesSite({ siteRoot })).resolves.toEqual({
      siteRoot,
      hasCoverage: true,
    });
  });

  test("fails when the coverage surface is required but missing", async () => {
    const root = await makeFixtureRoot();
    const schemasDir = path.join(root, "schemas");
    const siteRoot = path.join(root, "site");

    await fs.mkdir(schemasDir, { recursive: true });
    await fs.writeFile(
      path.join(schemasDir, "cx-config-v1.schema.json"),
      '{"$id":"https://example.invalid/cx-config-v1.schema.json"}\n',
      "utf8",
    );

    await assemblePagesSite({
      siteRoot,
      schemasDir,
      coverageDir: path.join(root, "missing-coverage"),
    });

    await expect(checkPagesSite({ siteRoot })).rejects.toThrow(
      "Pages root index must link to /coverage/.",
    );
  });
});
