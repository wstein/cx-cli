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

async function exists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

describe("Antora layout contract", () => {
  test("repository uses the standard docs-root component layout and ui bundle path", async () => {
    const playbook = await readText("antora-playbook.yml");
    const antora = await readText("docs/antora.yml");

    expect(playbook).toContain("start_path: docs");
    expect(playbook).toContain("url: ./docs/ui");

    expect(antora).toContain("name: cx");
    expect(antora).toContain("title: CX Documentation");
    expect(antora).toContain("version: '0.4'");
    expect(antora).toContain("- modules/ROOT/nav.adoc");

    expect(await exists("docs/modules/ROOT/pages")).toBe(true);
    expect(await exists("docs/modules/ROOT/partials")).toBe(true);
    expect(await exists("docs/modules/ROOT/attachments")).toBe(true);
    expect(await exists("docs/modules/ROOT/examples")).toBe(true);
    expect(await exists("docs/modules/ROOT/images")).toBe(true);
    expect(await exists("docs/ui/layouts/default.hbs")).toBe(true);

    expect(await exists("docs/antora/modules/ROOT/pages")).toBe(false);
    expect(await exists("docs/antora-ui/layouts/default.hbs")).toBe(false);
  });
});
