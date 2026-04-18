// test-lane: unit
import { describe, expect, test } from "bun:test";

import {
  buildBundleIndexText,
  buildSectionHeaderText,
} from "../../src/repomix/handover.js";

describe("handover text", () => {
  test("builds a self-explaining section header without changing canonical fields", () => {
    const header = buildSectionHeaderText({
      projectName: "demo",
      sectionName: "docs",
      outputFile: "demo-repomix-docs.xml.txt",
      fileCount: 3,
      style: "xml",
      bundleIndexFile: "demo-bundle-index.txt",
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
    expect(header).toContain("bundle index: demo-bundle-index.txt");
  });

  test("keeps the bundle index focused on shared handoff context", () => {
    const indexText = buildBundleIndexText({
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

    expect(indexText).toContain("cx bundle index");
    expect(indexText).toContain(
      "purpose: shared handover companion for the rendered section outputs below.",
    );
    expect(indexText).toContain(
      "use this index with the section files; each section output remains self-contained.",
    );
  });
});
