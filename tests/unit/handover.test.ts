// test-lane: unit
import { describe, expect, test } from "vitest";

import { renderSharedHandover } from "../../src/render/handover.js";
import { buildSectionHandoverText } from "../../src/render/sectionHandover.js";

describe("handover text", () => {
  test("builds a self-explaining section header without changing canonical fields", () => {
    const header = buildSectionHandoverText({
      projectName: "demo",
      sectionName: "docs",
      outputFile: "demo-repomix-docs.xml.txt",
      fileCount: 3,
      style: "xml",
      handoverFile: "demo-handover.xml.txt",
    });

    expect(header).toContain("cx section handover");
    expect(header).toContain(
      "artifact: deterministic section snapshot for human and AI review.",
    );
    expect(header).toContain(
      "usage: review and cite the logical paths in this snapshot, but make repository edits in the original source tree.",
    );
    expect(header).toContain(
      "path semantics: each logical path points to the original repository location for that file.",
    );
    expect(header).toContain(
      "authoritative semantics: cx-meta, cx-policy, archive markers, manifests, and validation rules remain canonical.",
    );
    expect(header).toContain("project: demo");
    expect(header).toContain("section: docs");
    expect(header).toContain("files: 3");
    expect(header).toContain("shared handover: demo-handover.xml.txt");
    expect(header).toContain(
      "shared context: keep this file together with the shared handover when handing off multiple sections.",
    );
  });

  test("keeps the shared handover focused on shared handoff context", () => {
    const indexText = renderSharedHandover({
      style: "xml",
      projectName: "demo",
      sectionOutputs: [
        {
          name: "docs",
          style: "xml",
          outputFile: "demo-repomix-docs.xml.txt",
          fileCount: 2,
          tokenCount: 12,
          outputTokenCount: 16,
        },
      ],
      assetPaths: [],
      provenanceSummary: [{ marker: "section_match", count: 2 }],
    });

    expect(indexText).toContain("<cx_shared_handover>");
    expect(indexText).toContain("<project>demo</project>");
    expect(indexText).toContain(
      "<purpose>shared handover companion for the rendered section outputs below.</purpose>",
    );
    expect(indexText).toContain(
      "<usage>use this shared handover with the section files; each section output remains self-contained.</usage>",
    );
    expect(indexText).toContain(
      "<output_file>demo-repomix-docs.xml.txt</output_file>",
    );
  });

  test("renders bounded recent repository history in xml when present", () => {
    const indexText = renderSharedHandover({
      style: "xml",
      projectName: "demo",
      sectionOutputs: [],
      assetPaths: [],
      repoHistory: [
        {
          shortHash: "aaaaaaaaaaaa",
          subject: "Add native shared handover history",
        },
        {
          shortHash: "bbbbbbbbbbbb",
          subject: "Tighten contract tests for manifest v8",
        },
      ],
    });

    expect(indexText).toContain("<recent_repository_history>");
    expect(indexText).toContain("<short_hash>aaaaaaaaaaaa</short_hash>");
    expect(indexText).toContain(
      "<subject>Add native shared handover history</subject>",
    );
    expect(indexText).toContain("<short_hash>bbbbbbbbbbbb</short_hash>");
  });

  test("renders plain handover history without broken bullets", () => {
    const indexText = renderSharedHandover({
      style: "plain",
      projectName: "demo",
      sectionOutputs: [],
      assetPaths: [],
      repoHistory: [
        {
          shortHash: "aaaaaaaaaaaa",
          subject: "Add native shared handover history",
        },
      ],
    });

    expect(indexText).toContain("recent repository history:");
    expect(indexText).toContain(
      "- aaaaaaaaaaaa Add native shared handover history",
    );
    expect(indexText).not.toContain("- \naaaaaaaaaaaa");
  });

  test("renders markdown handover with direct section and history headings", () => {
    const indexText = renderSharedHandover({
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
          subject: "Add markdown handover coverage",
        },
      ],
    });

    expect(indexText).toContain("# cx shared handover");
    expect(indexText).toContain("## Sections");
    expect(indexText).toContain("## Recent repository history");
    expect(indexText).toContain(
      "- docs: demo-repomix-docs.md | markdown | 1 files | packed tokens 4 | output tokens 9",
    );
    expect(indexText).toContain(
      "- aaaaaaaaaaaa Add markdown handover coverage",
    );
  });

  test("renders json handover with a schema-shaped payload", () => {
    const indexText = renderSharedHandover({
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
          subject: "Add json handover coverage",
        },
      ],
    });

    const parsed = JSON.parse(indexText) as {
      kind: string;
      sections: Array<{ outputFile: string; packedTokens: number }>;
      assets?: Array<{ sourcePath: string }>;
      inclusionProvenance?: Array<{ marker: string }>;
      recentRepositoryHistory?: Array<{ shortHash: string }>;
    };

    expect(parsed.kind).toBe("cx_shared_handover");
    expect(parsed.sections[0]?.outputFile).toBe("demo-repomix-src.json.txt");
    expect(parsed.sections[0]?.packedTokens).toBe(5);
    expect(parsed.assets?.[0]?.sourcePath).toBe("logo.png");
    expect(parsed.inclusionProvenance?.[0]?.marker).toBe("section_match");
    expect(parsed.recentRepositoryHistory?.[0]?.shortHash).toBe("bbbbbbbbbbbb");
  });
});
