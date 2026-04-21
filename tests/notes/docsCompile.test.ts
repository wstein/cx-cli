// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { compileDocsFromBundle } from "../../src/docs/compile.js";
import { compileNotesExtractBundle } from "../../src/notes/extract.js";

let workspaceRoot: string;

function noteContent(params: {
  id: string;
  title: string;
  tags: string[];
  target: "current" | "v0.4" | "backlog";
  summary: string;
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

This note captures durable repository context for ${params.title}.

## Why

This note exists so compilation remains deterministic and reviewable.

## How

Use canonical notes as the upstream source of truth.

## Links

- [[src/cli/main.ts]]
`;
}

beforeEach(async () => {
  workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cx-docs-compile-"));
  await fs.mkdir(path.join(workspaceRoot, "notes"));
});

afterEach(async () => {
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

describe("compileDocsFromBundle", () => {
  test("compiles final docs directly from a built-in profile", async () => {
    await fs.writeFile(
      path.join(workspaceRoot, "notes", "Render Kernel Constitution.md"),
      noteContent({
        id: "20260421140000",
        title: "Render Kernel Constitution",
        tags: ["architecture", "kernel", "contract"],
        target: "current",
        summary:
          "The render kernel owns the production proof path and keeps oracle seams outside the ordinary runtime path.",
      }),
    );

    const result = await compileDocsFromBundle({
      workspaceRoot,
      profileName: "arc42",
    });

    expect(result.bundle.profile.name).toBe("arc42");
    expect(result.writtenFiles).toEqual([
      path.join(
        workspaceRoot,
        "docs/modules/ROOT/pages/architecture/index.adoc",
      ),
    ]);

    const compiledDocPath = result.writtenFiles[0];
    expect(compiledDocPath).toBeDefined();
    const compiledDoc = await fs.readFile(compiledDocPath ?? "", "utf8");
    expect(compiledDoc).toContain("= CX Architecture");
    expect(compiledDoc).toContain(
      "This document was compiled from canonical notes.",
    );
    expect(compiledDoc).toContain("== Solution Strategy");
    expect(compiledDoc).toContain("=== Render Kernel Constitution");
  });

  test("compiles final docs from an existing extracted bundle", async () => {
    await fs.writeFile(
      path.join(workspaceRoot, "notes", "Friday To Monday Workflow.md"),
      noteContent({
        id: "20260421140100",
        title: "Friday To Monday Workflow",
        tags: ["workflow", "manual", "operator"],
        target: "current",
        summary:
          "Operators use the Friday-to-Monday workflow to keep context durable across sessions.",
      }),
    );

    const bundle = await compileNotesExtractBundle({
      workspaceRoot,
      profileName: "manual",
      format: "xml",
    });

    const result = await compileDocsFromBundle({
      workspaceRoot,
      bundlePath: path.relative(workspaceRoot, bundle.outputPath),
      outputPaths: ["compiled/manual-output.adoc"],
    });

    expect(result.bundlePath).toBe(bundle.outputPath);
    expect(result.writtenFiles).toEqual([
      path.join(workspaceRoot, "compiled/manual-output.adoc"),
    ]);

    const compiledDocPath = result.writtenFiles[0];
    expect(compiledDocPath).toBeDefined();
    const compiledDoc = await fs.readFile(compiledDocPath ?? "", "utf8");
    expect(compiledDoc).toContain("= CX Operator Manual");
    expect(compiledDoc).toContain("Bundle profile: `manual`");
    expect(compiledDoc).toContain("=== Friday To Monday Workflow");
  });
});
