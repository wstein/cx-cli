// test-lane: contract

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { buildStructuredPlanFromFiles } from "../../src/render/structuredPlan.js";

const TEMP_ROOTS: string[] = [];

afterEach(async () => {
  await Promise.all(
    TEMP_ROOTS.splice(0).map((root) =>
      fs.rm(root, { recursive: true, force: true }),
    ),
  );
});

async function createPlanFixture(files: Record<string, string>) {
  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "cx-native-plan-contract-"),
  );
  TEMP_ROOTS.push(rootDir);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(rootDir, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf8");
  }

  return rootDir;
}

describe("native structured plan contract", () => {
  test("applies exact packed-content normalization before hashing and planning", async () => {
    const rootDir = await createPlanFixture({
      "docs/crlf.md": "alpha\r\nbeta\r\n",
      "docs/plain.txt": "omega\n",
      "docs/empty.txt": "",
      "docs/no-newline.txt": "tail",
    });

    const plan = await buildStructuredPlanFromFiles({
      sourceRoot: rootDir,
      explicitFiles: [
        path.join(rootDir, "docs", "crlf.md"),
        path.join(rootDir, "docs", "plain.txt"),
        path.join(rootDir, "docs", "empty.txt"),
        path.join(rootDir, "docs", "no-newline.txt"),
      ],
      encoding: "o200k_base",
    });

    expect(plan.entries.map((entry) => [entry.path, entry.content])).toEqual([
      ["docs/crlf.md", "alpha\nbeta"],
      ["docs/empty.txt", ""],
      ["docs/no-newline.txt", "tail"],
      ["docs/plain.txt", "omega"],
    ]);
  });

  test("derives stable language tags and lexicographic ordering from repository paths", async () => {
    const rootDir = await createPlanFixture({
      "zeta/config.yaml": "name: demo\n",
      "src/index.ts": "export const ok = true;\n",
      "notes/guide.md": "# Guide\n",
      "schemas/data.json": "{}\n",
      "xml/report.xml": "<root />\n",
      "misc/README.custom": "opaque\n",
    });

    const plan = await buildStructuredPlanFromFiles({
      sourceRoot: rootDir,
      explicitFiles: [
        path.join(rootDir, "zeta", "config.yaml"),
        path.join(rootDir, "src", "index.ts"),
        path.join(rootDir, "notes", "guide.md"),
        path.join(rootDir, "schemas", "data.json"),
        path.join(rootDir, "xml", "report.xml"),
        path.join(rootDir, "misc", "README.custom"),
      ],
      encoding: "o200k_base",
    });

    expect(plan.ordering).toEqual([
      "misc/README.custom",
      "notes/guide.md",
      "schemas/data.json",
      "src/index.ts",
      "xml/report.xml",
      "zeta/config.yaml",
    ]);
    expect(
      plan.entries.map((entry) => [entry.path, entry.language ?? null]),
    ).toEqual([
      ["misc/README.custom", null],
      ["notes/guide.md", "markdown"],
      ["schemas/data.json", "json"],
      ["src/index.ts", "typescript"],
      ["xml/report.xml", "xml"],
      ["zeta/config.yaml", "yaml"],
    ]);
  });
});
