import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkToolAccess,
  DEFAULT_POLICY,
  STRICT_POLICY,
  TOOL_CAPABILITIES,
} from "../../src/mcp/policy.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const REGISTERED_TOOL_NAMES = [
  "list",
  "grep",
  "read",
  "replace_repomix_span",
  "inspect",
  "bundle",
  "doctor_mcp",
  "doctor_overlaps",
  "doctor_secrets",
  "doctor_workflow",
  "notes_new",
  "notes_read",
  "notes_update",
  "notes_delete",
  "notes_rename",
  "notes_search",
  "notes_list",
  "notes_backlinks",
  "notes_orphans",
  "notes_code_links",
  "notes_links",
] as const;

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

function sectionBody(document: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = document.indexOf(marker);
  if (start === -1) {
    return "";
  }
  const nextHeading = document.indexOf("\n## ", start + marker.length);
  return document.slice(start, nextHeading === -1 ? undefined : nextHeading);
}

describe("MCP policy contract", () => {
  test("every registered MCP tool has a capability classification", () => {
    const missing = REGISTERED_TOOL_NAMES.filter(
      (toolName) => TOOL_CAPABILITIES[toolName] === undefined,
    );
    expect(missing).toEqual([]);
  });

  test("default policy allows plan and denies mutate", () => {
    expect(checkToolAccess("bundle", DEFAULT_POLICY).allowed).toBe(true);
    expect(checkToolAccess("inspect", DEFAULT_POLICY).allowed).toBe(true);
    expect(checkToolAccess("notes_new", DEFAULT_POLICY).allowed).toBe(false);
  });

  test("strict policy denies plan and mutate", () => {
    expect(checkToolAccess("bundle", STRICT_POLICY).allowed).toBe(false);
    expect(checkToolAccess("inspect", STRICT_POLICY).allowed).toBe(false);
    expect(checkToolAccess("list", STRICT_POLICY).allowed).toBe(true);
  });

  test("bundle and inspect are classified as plan", () => {
    expect(TOOL_CAPABILITIES.bundle).toBe("plan");
    expect(TOOL_CAPABILITIES.inspect).toBe("plan");
  });

  test("taxonomy docs classify bundle as plan", async () => {
    const docsTaxonomy = await readText("docs/MCP_TOOL_INTENT_TAXONOMY.md");
    const notesTaxonomy = await readText("notes/MCP Tool Intent Taxonomy.md");
    const docsPlan = sectionBody(docsTaxonomy, "Plan / Preview");
    const docsWrite = sectionBody(docsTaxonomy, "Write / Mutate Tools");
    const docsRead = sectionBody(docsTaxonomy, "Read / Observe Tools");
    const notesPlan = sectionBody(notesTaxonomy, "Plan / Preview");
    const notesWrite = sectionBody(notesTaxonomy, "Write / Mutate");
    const notesRead = sectionBody(notesTaxonomy, "Read / Observe");

    expect(docsPlan).toContain("- `bundle`");
    expect(docsPlan).toContain("- `inspect`");
    expect(docsWrite).not.toContain("- `bundle`");
    expect(docsWrite).not.toContain("- `inspect`");
    expect(docsRead).not.toContain("- `inspect`");

    expect(notesPlan).toContain("- `bundle`");
    expect(notesPlan).toContain("- `inspect`");
    expect(notesWrite).not.toContain("- `bundle`");
    expect(notesWrite).not.toContain("- `inspect`");
    expect(notesRead).not.toContain("- `inspect`");
  });
});
