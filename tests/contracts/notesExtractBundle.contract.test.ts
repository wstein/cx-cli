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
  test("freezes machine-payload markers across markdown, xml, json, and plain bundles", async () => {
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
    const json = await compileNotesExtractBundle({
      workspaceRoot,
      profileName: "arc42",
      format: "json",
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

    expect(xml.content).toContain(
      '<cx-notes-bundle version="1" format="llm-tagged-text">',
    );
    expect(xml.content).toContain("<profile>");
    expect(xml.content).toContain("name: arc42");
    expect(xml.content).toContain("<authoring-contract>");
    expect(xml.content).toContain("<required-sections>");
    expect(xml.content).toContain('<section id="introduction-and-goals">');
    expect(xml.content).toContain("<notes>");
    expect(xml.content).toContain(
      '<note id="20260421153000" target="current" section="introduction-and-goals"',
    );
    expect(xml.content).toContain('<section key="what" title="What">');
    expect(xml.content).toContain('<machine-payload format="json">');
    expect(xml.content).toContain("</machine-payload>");
    expect(xml.content).not.toContain('<?xml version="1.0" encoding="UTF-8"?>');

    expect(json.content.trimStart().startsWith("{")).toBe(true);
    expect(json.content).toContain('"outputFormat": "json"');

    expect(plain.content).toContain("CX NOTES MACHINE PAYLOAD START");
    expect(plain.content).toContain("CX NOTES MACHINE PAYLOAD END");

    expect(parseNotesExtractBundleContent(markdown.content)).toEqual(
      markdown.bundle,
    );
    expect(parseNotesExtractBundleContent(xml.content)).toEqual(xml.bundle);
    expect(parseNotesExtractBundleContent(json.content)).toEqual(json.bundle);
    expect(parseNotesExtractBundleContent(plain.content)).toEqual(plain.bundle);
  });

  test("fixture example bundles remain parseable for downstream tooling experiments", async () => {
    const fixturePaths = [
      "tests/fixtures/bundles/notes-arc42-example.md",
      "tests/fixtures/bundles/notes-arc42-example.xml",
      "tests/fixtures/bundles/notes-arc42-example.json",
      "tests/fixtures/bundles/notes-arc42-example.txt",
    ];

    for (const fixtureRelativePath of fixturePaths) {
      const fixturePath = path.join(process.cwd(), fixtureRelativePath);
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
    }
  });
});
