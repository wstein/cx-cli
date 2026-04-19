// test-lane: contract
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
  test("operating modes hub is the main conceptual entrypoint", async () => {
    const docsIndex = await readText("docs/README.md");
    const operatingModes = await readText("docs/OPERATING_MODES.md");
    const manual = await readText("docs/MANUAL.md");

    expect(docsIndex).toContain("[OPERATING_MODES.md](./OPERATING_MODES.md)");
    expect(operatingModes).toContain(
      "Need fast interactive AI help on live code? Use `cx mcp`.",
    );
    expect(operatingModes).toContain(
      "Need a reproducible, promotable artifact? Use `cx bundle`.",
    );
    expect(operatingModes).toContain(
      "Need durable design memory? Use `cx notes`.",
    );
    expect(manual).toContain("See: [OPERATING_MODES.md](OPERATING_MODES.md)");
  });

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

  test("stop conditions explain the invariant they protect", async () => {
    const manual = await readText("docs/MANUAL.md");
    const extractionSafety = await readText("docs/EXTRACTION_SAFETY.md");
    const agentModel = await readText("docs/AGENT_OPERATING_MODEL.md");

    expect(manual).toContain("Why this stops you: overlap failure protects");
    expect(manual).toContain("Why this stops you: tracked-file drift means");
    expect(extractionSafety).toContain(
      "Why this stops you: once the recovered packed content no longer matches",
    );
    expect(agentModel).toContain(
      "Why this stops you: an exploratory session should not silently cross from analysis into repository mutation.",
    );
  });
});
