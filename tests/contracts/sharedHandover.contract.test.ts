// test-lane: contract

import { describe, expect, test } from "vitest";

import { renderSharedHandover } from "../../src/render/handover.js";

describe("shared handover contract", () => {
  test("xml handover keeps sparse llm-anchor tags instead of a full xml document", () => {
    const rendered = renderSharedHandover({
      style: "xml",
      projectName: "demo",
      sectionOutputs: [
        {
          name: "docs",
          style: "xml",
          outputFile: "demo-docs.xml.txt",
          fileCount: 1,
          tokenCount: 4,
          outputTokenCount: 9,
        },
      ],
      assetPaths: [],
      provenanceSummary: [{ marker: "section_match", count: 1 }],
      repoHistory: [
        {
          shortHash: "cccccccccccc",
          message: "Add xml handover contract\n\nBody context",
        },
      ],
    });

    expect(rendered).toContain("cx shared handover\nproject: demo");
    expect(rendered).toContain("<section_inventory>");
    expect(rendered).toContain("</section_inventory>");
    expect(rendered).toContain("<inclusion_provenance>");
    expect(rendered).toContain("</inclusion_provenance>");
    expect(rendered).toContain("<recent_repository_history>");
    expect(rendered).toContain("</recent_repository_history>");
    expect(rendered).toContain("<usage>");
    expect(rendered).toContain("</usage>");
    expect(rendered).toContain(
      "- docs: demo-docs.xml.txt | xml | 1 files | packed tokens 4 | output tokens 9",
    );
    expect(rendered).toContain(
      "- cccccccccccc\n  Add xml handover contract\n  \n  Body context",
    );
    expect(rendered).not.toContain("<?xml");
    expect(rendered).not.toContain("<cx_shared_handover>");
  });

  test("markdown handover keeps the current heading and bullet contract", () => {
    const rendered = renderSharedHandover({
      style: "markdown",
      projectName: "demo",
      sectionOutputs: [
        {
          name: "docs",
          style: "markdown",
          outputFile: "demo-docs.md",
          fileCount: 1,
          tokenCount: 4,
          outputTokenCount: 9,
        },
      ],
      assetPaths: [],
      repoHistory: [
        {
          shortHash: "aaaaaaaaaaaa",
          message: "Add markdown handover contract\n\nBody context",
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
        "- docs: demo-docs.md | markdown | 1 files | packed tokens 4 | output tokens 9",
        "",
        "## Recent repository history",
        "- aaaaaaaaaaaa",
        "  Add markdown handover contract",
        "  ",
        "  Body context",
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
          outputFile: "demo-src.json.txt",
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
          message: "Add json handover contract\n\nBody context",
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
              outputFile: "demo-src.json.txt",
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
              message: "Add json handover contract\n\nBody context",
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
