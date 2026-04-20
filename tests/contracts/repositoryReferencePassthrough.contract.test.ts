// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const REPOSITORY_DOCS_ROOT = path.join(
  ROOT,
  "docs/modules/ROOT/pages/repository/docs",
);
const ALLOWED_PASSTHROUGH_FILES = [
  "agent_integration.adoc",
  "governance.adoc",
  "init_template_contract.adoc",
  "notes_module_spec.adoc",
  "stability.adoc",
  "template_crystal.adoc",
  "template_elixir.adoc",
  "template_go.adoc",
  "template_rust.adoc",
  "template_typescript.adoc",
  "template_zig.adoc",
];

async function collectRepositoryDocFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectRepositoryDocFiles(fullPath);
      }
      return entry.isFile() && entry.name.endsWith(".adoc")
        ? [path.relative(REPOSITORY_DOCS_ROOT, fullPath)]
        : [];
    }),
  );
  return files.flat().sort();
}

describe("repository reference passthrough contract", () => {
  test("new raw HTML passthrough blocks are not introduced silently", async () => {
    const files = await collectRepositoryDocFiles(REPOSITORY_DOCS_ROOT);
    const passthroughFiles = (
      await Promise.all(
        files.map(async (relativePath) => {
          const contents = await fs.readFile(
            path.join(REPOSITORY_DOCS_ROOT, relativePath),
            "utf8",
          );
          return /^\+\+\+\+$/m.test(contents) ? relativePath : null;
        }),
      )
    ).filter(Boolean);

    expect(passthroughFiles).toEqual(ALLOWED_PASSTHROUGH_FILES);
  });
});
