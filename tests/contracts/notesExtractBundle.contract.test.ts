// test-lane: contract

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
  summary: string;
}): string {
  return `---
id: ${params.id}
title: ${JSON.stringify(params.title)}
aliases: []
tags: [${params.tags.map((tag) => JSON.stringify(tag)).join(", ")}]
target: current
---
${params.summary}

## What

This note captures durable repository context for ${params.title}.

## Why

This note exists so extracted bundles stay deterministic and reviewable.

## How

Use the extracted bundle as a machine-friendly input to a later manual LLM step.

## Links

- [[src/cli/main.ts]]
`;
}

beforeEach(async () => {
  workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "cx-notes-bundle-contract-"),
  );
  await fs.mkdir(path.join(workspaceRoot, "notes"));
});

afterEach(async () => {
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

describe("notes extract bundle contract", () => {
  test("freezes machine-payload markers across markdown, xml, and plain bundles", async () => {
    await fs.writeFile(
      path.join(workspaceRoot, "notes", "Render Kernel Constitution.md"),
      noteContent({
        id: "20260421153000",
        title: "Render Kernel Constitution",
        tags: ["architecture", "kernel", "contract"],
        summary:
          "The render kernel owns the production proof path and remains the canonical rendering boundary.",
      }),
    );

    const markdown = await compileNotesExtractBundle({
      workspaceRoot,
      profileName: "arc42",
      format: "markdown",
    });
    const xml = await compileNotesExtractBundle({
      workspaceRoot,
      profileName: "arc42",
      format: "xml",
    });
    const plain = await compileNotesExtractBundle({
      workspaceRoot,
      profileName: "arc42",
      format: "plain",
    });

    expect(markdown.content).toContain(
      "<!-- cx-notes-bundle-payload:start -->",
    );
    expect(markdown.content).toContain("<!-- cx-notes-bundle-payload:end -->");
    expect(markdown.content).toContain("```json");

    expect(xml.content).toContain('<machine-payload format="json">');
    expect(xml.content).toContain("</machine-payload>");

    expect(plain.content).toContain("CX NOTES MACHINE PAYLOAD START");
    expect(plain.content).toContain("CX NOTES MACHINE PAYLOAD END");

    expect(parseNotesExtractBundleContent(markdown.content)).toEqual(
      markdown.bundle,
    );
    expect(parseNotesExtractBundleContent(xml.content)).toEqual(xml.bundle);
    expect(parseNotesExtractBundleContent(plain.content)).toEqual(plain.bundle);
  });

  test("fixture example bundle remains parseable for downstream tooling experiments", async () => {
    const fixturePath = path.join(
      process.cwd(),
      "tests/fixtures/bundles/notes-arc42-example.llm.md",
    );
    const content = await fs.readFile(fixturePath, "utf8");
    const bundle = parseNotesExtractBundleContent(content, fixturePath);

    expect(bundle.profile.name).toBe("arc42");
    expect(bundle.profile.requiredNotes).toEqual([
      "Render Kernel Constitution",
    ]);
    expect(bundle.profile.requiredSections).toEqual([
      "introduction-and-goals",
      "constraints",
      "solution-strategy",
      "building-block-view",
      "runtime-view",
      "cross-cutting-concepts",
      "quality-scenarios",
      "risks-and-technical-debt",
      "reference-notes",
    ]);
    expect(bundle.notes.map((note) => note.title)).toEqual([
      "Render Kernel Constitution",
    ]);
  });
});
