import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

describe("docs assurance contract", () => {
  test("manual defines an assurance ladder", async () => {
    const manual = await readText("docs/MANUAL.md");

    expect(manual).toContain("## Assurance Ladder");
    expect(manual).toContain("`bun run verify`");
    expect(manual).toContain("`bun run certify`");
    expect(manual).toContain("`bun run integrity`");
    expect(manual).toContain("`bun run verify-release`");
  });

  test("release checklist states certify as CI-equivalent gate", async () => {
    const checklist = await readText("docs/RELEASE_CHECKLIST.md");

    expect(checklist).toContain("pre-tag CI-equivalent gate");
    expect(checklist).toContain("Repomix fork compatibility smoke");
    expect(checklist).toContain("bundle transition matrix smoke");
    expect(checklist).toContain("release integrity smoke");
  });

  test("notes module spec documents linked-note enrichment semantics", async () => {
    const notesSpec = await readText("docs/NOTES_MODULE_SPEC.md");

    expect(notesSpec).toContain("## Linked-Note Enrichment Semantics");
    expect(notesSpec).toContain("inclusion-changing, not advisory");
    expect(notesSpec).toContain("Run `cx inspect --json`");
    expect(notesSpec).toContain("`cx notes graph --id <seed> --depth <n>`");
    expect(notesSpec).toContain("Depth semantics for graph inspection");
  });
});
