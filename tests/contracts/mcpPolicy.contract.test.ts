// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  checkToolAccess,
  DEFAULT_POLICY,
  STRICT_POLICY,
} from "../../src/mcp/policy.js";
import {
  CX_MCP_TOOL_CAPABILITIES,
  CX_MCP_TOOL_NAMES,
  CX_MCP_TOOL_STABILITY,
} from "../../src/mcp/tools/catalog.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

function sectionBody(document: string, heading: string): string {
  const htmlMarker = `<h2>${heading}</h2>`;
  const markdownMarker = `## ${heading}`;
  const htmlStart = document.indexOf(htmlMarker);
  if (htmlStart !== -1) {
    const nextHeading = document.indexOf("<h2>", htmlStart + htmlMarker.length);
    return document.slice(
      htmlStart,
      nextHeading === -1 ? undefined : nextHeading,
    );
  }

  const markdownStart = document.indexOf(markdownMarker);
  if (markdownStart === -1) {
    return "";
  }
  const nextHeading = document.indexOf(
    "\n## ",
    markdownStart + markdownMarker.length,
  );
  return document.slice(
    markdownStart,
    nextHeading === -1 ? undefined : nextHeading,
  );
}

describe("MCP policy contract", () => {
  test("every registered MCP tool has a capability classification", () => {
    const missing = CX_MCP_TOOL_NAMES.filter(
      (toolName) => CX_MCP_TOOL_CAPABILITIES[toolName] === undefined,
    );
    expect(missing).toEqual([]);
  });

  test("every registered MCP tool has an explicit stability tier", () => {
    const missing = CX_MCP_TOOL_NAMES.filter(
      (toolName) => CX_MCP_TOOL_STABILITY[toolName] === undefined,
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
    expect(CX_MCP_TOOL_CAPABILITIES.bundle).toBe("plan");
    expect(CX_MCP_TOOL_CAPABILITIES.inspect).toBe("plan");
  });

  test("stable MCP contract includes notes_graph and keeps doctor tools beta", () => {
    expect(CX_MCP_TOOL_STABILITY.bundle).toBe("STABLE");
    expect(CX_MCP_TOOL_STABILITY.notes_graph).toBe("STABLE");
    expect(CX_MCP_TOOL_STABILITY.doctor_mcp).toBe("BETA");
    expect(CX_MCP_TOOL_STABILITY.replace_repomix_span).toBe("BETA");
  });

  test("taxonomy docs classify bundle as plan", async () => {
    const docsTaxonomy = await readText(
      "docs/modules/ROOT/pages/repository/docs/mcp_tool_intent_taxonomy.adoc",
    );
    const notesTaxonomy = await readText("notes/MCP Tool Intent Taxonomy.md");
    const docsPlan = sectionBody(docsTaxonomy, "Plan / Preview");
    const docsWrite = sectionBody(docsTaxonomy, "Write / Mutate Tools");
    const docsRead = sectionBody(docsTaxonomy, "Read / Observe Tools");
    const notesPlan = sectionBody(notesTaxonomy, "Plan / Preview");
    const notesWrite = sectionBody(notesTaxonomy, "Write / Mutate");
    const notesRead = sectionBody(notesTaxonomy, "Read / Observe");

    expect(docsPlan).toContain("<li><code>bundle</code></li>");
    expect(docsPlan).toContain("<li><code>inspect</code></li>");
    expect(docsWrite).not.toContain("<code>bundle</code>");
    expect(docsWrite).not.toContain("<code>inspect</code>");
    expect(docsRead).not.toContain("<code>inspect</code>");

    expect(notesPlan).toContain("- `bundle`");
    expect(notesPlan).toContain("- `inspect`");
    expect(notesWrite).not.toContain("- `bundle`");
    expect(notesWrite).not.toContain("- `inspect`");
    expect(notesRead).not.toContain("- `inspect`");
  });
});
