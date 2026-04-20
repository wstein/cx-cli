// test-lane: contract

import { describe, expect, test } from "vitest";

import { renderSharedHandover } from "../../src/render/handover.js";

describe("shared handover contract", () => {
  test("markdown handover keeps the current heading and bullet contract", () => {
    const rendered = renderSharedHandover({
      style: "markdown",
      projectName: "demo",
      sectionOutputs: [
        {
          name: "docs",
          style: "markdown",
          outputFile: "demo-repomix-docs.md",
          fileCount: 1,
          tokenCount: 4,
          outputTokenCount: 9,
        },
      ],
      assetPaths: [],
      repoHistory: [
        {
          shortHash: "aaaaaaaaaaaa",
          subject: "Add markdown handover contract",
        },
      ],
    });

    expect(rendered).toBe(
      [
        "# cx shared handover",
        "",
        "project: demo",
        "purpose: shared handover companion for the rendered section outputs below.",
        "",
        "## Sections",
        "- docs: demo-repomix-docs.md | markdown | 1 files | packed tokens 4 | output tokens 9",
        "",
        "## Recent repository history",
        "- aaaaaaaaaaaa Add markdown handover contract",
        "",
        "use this shared handover with the section files; each section output remains self-contained.",
        "",
      ].join("\n"),
    );
  });

  test("json handover keeps the current schema-shaped contract", () => {
    const rendered = renderSharedHandover({
      style: "json",
      projectName: "demo",
      sectionOutputs: [
        {
          name: "src",
          style: "json",
          outputFile: "demo-repomix-src.json.txt",
          fileCount: 2,
          tokenCount: 5,
          outputTokenCount: 8,
        },
      ],
      assetPaths: [{ sourcePath: "logo.png", storedPath: "assets/logo.png" }],
      provenanceSummary: [{ marker: "section_match", count: 2 }],
      repoHistory: [
        {
          shortHash: "bbbbbbbbbbbb",
          subject: "Add json handover contract",
        },
      ],
    });

    expect(rendered).toBe(
      `${JSON.stringify(
        {
          kind: "cx_shared_handover",
          project: "demo",
          purpose:
            "shared handover companion for the rendered section outputs below.",
          sections: [
            {
              name: "src",
              style: "json",
              outputFile: "demo-repomix-src.json.txt",
              fileCount: 2,
              packedTokens: 5,
              outputTokens: 8,
            },
          ],
          assets: [{ sourcePath: "logo.png", storedPath: "assets/logo.png" }],
          inclusionProvenance: [{ marker: "section_match", count: 2 }],
          recentRepositoryHistory: [
            {
              shortHash: "bbbbbbbbbbbb",
              subject: "Add json handover contract",
            },
          ],
          usage:
            "use this shared handover with the section files; each section output remains self-contained.",
        },
        null,
        2,
      )}\n`,
    );
  });
});
