// test-lane: unit
import { describe, expect, test } from "bun:test";
import type { ManifestFileRow } from "../../src/manifest/types.js";

import { selectManifestRows } from "../../src/shared/verifyFilters.js";

describe("shared verify filter utilities", () => {
  const rows: ManifestFileRow[] = [
    {
      path: "src/index.ts",
      kind: "text",
      section: "src",
      storedIn: "packed",
      sha256: "deadbeef",
      sizeBytes: 100,
      tokenCount: 12,
      mtime: "2025-01-01T00:00:00Z",
      mediaType: "text/typescript",
      outputStartLine: 1,
      outputEndLine: 10,
    },
    {
      path: "src/util.ts",
      kind: "text",
      section: "src",
      storedIn: "packed",
      sha256: "feedface",
      sizeBytes: 200,
      tokenCount: 18,
      mtime: "2025-01-01T00:00:00Z",
      mediaType: "text/typescript",
      outputStartLine: 11,
      outputEndLine: 25,
    },
    {
      path: "docs/guide.md",
      kind: "text",
      section: "docs",
      storedIn: "packed",
      sha256: "baadf00d",
      sizeBytes: 150,
      tokenCount: 22,
      mtime: "2025-01-01T00:00:00Z",
      mediaType: "text/markdown",
      outputStartLine: 26,
      outputEndLine: 40,
    },
    {
      path: "images/logo.png",
      kind: "asset",
      section: "-",
      storedIn: "copied",
      sha256: "c0ffee00",
      sizeBytes: 512,
      tokenCount: 0,
      mtime: "2025-01-01T00:00:00Z",
      mediaType: "image/png",
      outputStartLine: null,
      outputEndLine: null,
    },
  ];

  test("selectManifestRows filters by section", () => {
    const filtered = selectManifestRows(rows, {
      sections: ["src"],
      files: undefined,
    });
    expect(filtered.map((row) => row.path)).toEqual([
      "src/index.ts",
      "src/util.ts",
      "images/logo.png",
    ]);
  });

  test("selectManifestRows filters by file names", () => {
    const filtered = selectManifestRows(rows, {
      sections: undefined,
      files: ["docs/guide.md", "images/logo.png"],
    });
    expect(filtered.map((row) => row.path)).toEqual([
      "docs/guide.md",
      "images/logo.png",
    ]);
  });

  test("selectManifestRows applies both section and file filters", () => {
    const filtered = selectManifestRows(rows, {
      sections: ["src"],
      files: ["src/index.ts", "docs/guide.md"],
    });
    expect(filtered.map((row) => row.path)).toEqual(["src/index.ts"]);
  });
});
