// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  compileNotesExtractBundle,
  parseNotesExtractBundleContent,
} from "../../src/notes/extract.js";

let workspaceRoot: string;

function noteContent(params: {
  id: string;
  title: string;
  tags: string[];
  target: "current" | "v0.4" | "backlog";
  summary: string;
  what: string;
  why: string;
  how: string;
}): string {
  return `---
id: ${params.id}
title: ${JSON.stringify(params.title)}
aliases: []
tags: [${params.tags.map((tag) => JSON.stringify(tag)).join(", ")}]
target: ${params.target}
---
${params.summary}

## What

${params.what}

## Why

${params.why}

## How

${params.how}

## Links

- [[Render Kernel Constitution]]
- [[src/cli/main.ts]]
`;
}

beforeEach(async () => {
  workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cx-notes-extract-"));
  await fs.mkdir(path.join(workspaceRoot, "notes"));
});

afterEach(async () => {
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

describe("compileNotesExtractBundle", () => {
  test("builds a deterministic markdown LLM bundle from built-in profiles", async () => {
    await fs.writeFile(
      path.join(workspaceRoot, "notes", "Render Kernel Constitution.md"),
      noteContent({
        id: "20260421130000",
        title: "Render Kernel Constitution",
        tags: ["architecture", "kernel", "contract"],
        target: "current",
        summary:
          "The render kernel owns the production proof path so oracle seams remain external comparison tools instead of runtime dependencies.",
        what: "The native kernel is the canonical rendering and verification boundary for shipped proof-path execution.",
        why: "This keeps production trust anchored in deterministic kernel artifacts rather than external oracle behavior.",
        how: "Use oracle tooling only for parity diagnostics and reference comparison, not for ordinary bundle or verify flows.",
      }),
    );

    await fs.writeFile(
      path.join(
        workspaceRoot,
        "notes",
        "Friday To Monday Workflow Contract.md",
      ),
      noteContent({
        id: "20260421130100",
        title: "Friday To Monday Workflow Contract",
        tags: ["workflow", "manual", "operator"],
        target: "v0.4",
        summary:
          "The Friday-to-Monday workflow records how operators hand off repository context safely between sessions without degrading proof-path trust.",
        what: "The workflow captures how repository context travels through notes, bundles, and reviewable documentation surfaces.",
        why: "It protects continuity across sessions while keeping notes canonical and generated prose downstream.",
        how: "Follow the documented handoff path and keep note provenance attached to each generated artifact.",
      }),
    );

    await fs.writeFile(
      path.join(workspaceRoot, "notes", "Future Extraction Idea.md"),
      noteContent({
        id: "20260421130200",
        title: "Future Extraction Idea",
        tags: ["future", "docs"],
        target: "backlog",
        summary:
          "This note captures a future idea that should stay out of production-bound extraction bundles until it is scheduled.",
        what: "The idea is not implemented yet.",
        why: "Backlog items should not silently enter current document products.",
        how: "Keep it out of current-target extraction profiles.",
      }),
    );

    await fs.writeFile(
      path.join(workspaceRoot, "notes", "Unrelated Current Release Note.md"),
      noteContent({
        id: "20260421130300",
        title: "Unrelated Current Release Note",
        tags: ["release-only"],
        target: "current",
        summary:
          "This note is current but outside the built-in arc42 profile contract.",
        what: "It should not be selected just because the target is current.",
        why: "Profiles must select by declared scope instead of broad target leakage.",
        how: "Keep it out of bundles unless the profile explicitly asks for release-only content.",
      }),
    );

    const result = await compileNotesExtractBundle({
      workspaceRoot,
      profileName: "arc42",
      format: "markdown",
    });

    expect(result.outputPath).toBe(
      path.join(workspaceRoot, "dist", "notes-arc42.llm.md"),
    );
    expect(result.bundle.profile.name).toBe("arc42");
    expect(result.bundle.notes.map((note) => note.title)).toEqual([
      "Render Kernel Constitution",
      "Friday To Monday Workflow Contract",
    ]);
    expect(result.content).toContain("# CX Notes LLM Bundle");
    expect(result.content).toContain("## Authoring Contract");
    expect(result.content).toContain("## Machine Payload");
    expect(result.content).toContain("#### Note: Render Kernel Constitution");
    expect(result.content).not.toContain("Future Extraction Idea");
    expect(result.content).not.toContain("Unrelated Current Release Note");

    expect(parseNotesExtractBundleContent(result.content)).toEqual(
      result.bundle,
    );
  });

  test("builds a deterministic json LLM bundle from built-in profiles", async () => {
    await fs.writeFile(
      path.join(workspaceRoot, "notes", "Render Kernel Constitution.md"),
      noteContent({
        id: "20260421130400",
        title: "Render Kernel Constitution",
        tags: ["architecture", "kernel", "contract"],
        target: "current",
        summary:
          "The render kernel owns the production proof path so oracle seams remain external comparison tools instead of runtime dependencies.",
        what: "The native kernel is the canonical rendering and verification boundary for shipped proof-path execution.",
        why: "This keeps production trust anchored in deterministic kernel artifacts rather than external oracle behavior.",
        how: "Use oracle tooling only for parity diagnostics and reference comparison, not for ordinary bundle or verify flows.",
      }),
    );

    const result = await compileNotesExtractBundle({
      workspaceRoot,
      profileName: "arc42",
      format: "json",
    });

    expect(result.outputPath).toBe(
      path.join(workspaceRoot, "dist", "notes-arc42.llm.json"),
    );
    expect(result.content.trimStart().startsWith("{")).toBe(true);

    const parsedContent = JSON.parse(result.content) as {
      profile?: { name?: string; outputFormat?: string };
      notes?: Array<{ title?: string }>;
    };
    expect(parsedContent.profile?.name).toBe("arc42");
    expect(parsedContent.profile?.outputFormat).toBe("json");
    expect(parsedContent.notes?.[0]?.title).toBe("Render Kernel Constitution");

    expect(parseNotesExtractBundleContent(result.content)).toEqual(
      result.bundle,
    );
  });
});
