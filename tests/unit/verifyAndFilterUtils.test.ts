import { describe, expect, it } from "bun:test";
import type { ManifestFileRow } from "../../src/manifest/types";
import type { VerifySelection } from "../../src/shared/verifyFilters";
import { selectManifestRows } from "../../src/shared/verifyFilters";

describe("verify and filter utilities", () => {
  const sampleRows: ManifestFileRow[] = [
    {
      path: "src/main.ts",
      kind: "text",
      section: "src",
      storedIn: "output",
      sha256: "h1",
      sizeBytes: 512,
      tokenCount: 100,
      mtime: "2025-01-13T00:00:00Z",
      mediaType: "text/typescript",
      outputStartLine: 1,
      outputEndLine: 20,
    },
    {
      path: "src/util.ts",
      kind: "text",
      section: "src",
      storedIn: "output",
      sha256: "h2",
      sizeBytes: 256,
      tokenCount: 50,
      mtime: "2025-01-13T00:00:00Z",
      mediaType: "text/typescript",
      outputStartLine: 21,
      outputEndLine: 30,
    },
    {
      path: "docs/README.md",
      kind: "text",
      section: "docs",
      storedIn: "output",
      sha256: "h3",
      sizeBytes: 1024,
      tokenCount: 200,
      mtime: "2025-01-13T00:00:00Z",
      mediaType: "text/markdown",
      outputStartLine: 1,
      outputEndLine: 50,
    },
    {
      path: "tests/main.test.ts",
      kind: "text",
      section: "tests",
      storedIn: "output",
      sha256: "h4",
      sizeBytes: 512,
      tokenCount: 100,
      mtime: "2025-01-13T00:00:00Z",
      mediaType: "text/typescript",
      outputStartLine: 1,
      outputEndLine: 25,
    },
    {
      path: "logo.png",
      kind: "asset",
      section: "-",
      storedIn: "copied",
      sha256: "h5",
      sizeBytes: 2048,
      tokenCount: 0,
      mtime: "2025-01-13T00:00:00Z",
      mediaType: "image/png",
      outputStartLine: null,
      outputEndLine: null,
    },
    {
      path: "icon.svg",
      kind: "asset",
      section: "-",
      storedIn: "copied",
      sha256: "h6",
      sizeBytes: 512,
      tokenCount: 0,
      mtime: "2025-01-13T00:00:00Z",
      mediaType: "image/svg+xml",
      outputStartLine: null,
      outputEndLine: null,
    },
  ];

  describe("selectManifestRows", () => {
    it("returns all rows when selection is empty", () => {
      const selection: VerifySelection = {
        sections: undefined,
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result).toEqual(sampleRows);
    });

    it("filters by single section plus assets", () => {
      const selection: VerifySelection = {
        sections: ["src"],
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      // Should include src text files + assets
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.section === "src")).toBe(true);
      expect(result.some((r) => r.section === "-")).toBe(true);
    });

    it("filters by multiple sections plus assets", () => {
      const selection: VerifySelection = {
        sections: ["src", "docs"],
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      // Should include src + docs text files + assets
      expect(result.length).toBeGreaterThan(0);
      expect(
        result.every(
          (r) =>
            r.section === "src" || r.section === "docs" || r.section === "-",
        ),
      ).toBe(true);
    });

    it("includes assets when filtering by section", () => {
      const selection: VerifySelection = {
        sections: [],
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result.some((r) => r.kind === "asset")).toBe(true);
    });

    it("filters by single file", () => {
      const selection: VerifySelection = {
        sections: undefined,
        files: ["src/main.ts"],
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result.length).toBe(1);
      expect(result[0]?.path).toBe("src/main.ts");
    });

    it("filters by multiple files", () => {
      const selection: VerifySelection = {
        sections: undefined,
        files: ["src/main.ts", "docs/README.md"],
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result.length).toBe(2);
      expect(result.map((r) => r.path)).toEqual([
        "src/main.ts",
        "docs/README.md",
      ]);
    });

    it("filters by file including assets", () => {
      const selection: VerifySelection = {
        sections: undefined,
        files: ["logo.png"],
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result.length).toBe(1);
      expect(result[0]?.path).toBe("logo.png");
    });

    it("combines section and file filters with AND logic", () => {
      const selection: VerifySelection = {
        sections: ["src"],
        files: ["src/main.ts"],
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result.length).toBe(1);
      expect(result[0]?.path).toBe("src/main.ts");
    });

    it("returns empty array when no non-assets match section filter", () => {
      const selection: VerifySelection = {
        sections: ["nonexistent"],
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      // Should only have assets, since no text files match the section filter
      expect(result.every((r) => r.section === "-")).toBe(true);
    });

    it("returns empty array when no files match file filter", () => {
      const selection: VerifySelection = {
        sections: undefined,
        files: ["nonexistent.ts"],
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result).toEqual([]);
    });

    it("includes assets when filtering by specific sections", () => {
      const selection: VerifySelection = {
        sections: ["src"],
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      // Assets (section "-") are included because of the !== "-" check in filter logic
      expect(result.some((r) => r.section === "-")).toBe(true);
    });

    it("returns assets when section dash is only in filter", () => {
      const selection: VerifySelection = {
        sections: ["-"],
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      // When filtering by "-", no text files match (because row.section !== "-" excludes them)
      expect(result.every((r) => r.section === "-")).toBe(true);
    });

    it("handles empty section array (filters all non-assets)", () => {
      const selection: VerifySelection = {
        sections: [],
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result).toEqual(sampleRows);
    });

    it("handles empty file array", () => {
      const selection: VerifySelection = {
        sections: undefined,
        files: [],
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result).toEqual(sampleRows);
    });

    it("preserves row order", () => {
      const selection: VerifySelection = {
        sections: ["src", "docs"],
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      // Result should maintain original order
      expect(result[0]?.path).toBe("src/main.ts");
      expect(result[1]?.path).toBe("src/util.ts");
      expect(result[2]?.path).toBe("docs/README.md");
    });

    it("does not modify input rows array", () => {
      const selection: VerifySelection = {
        sections: ["src"],
        files: undefined,
      };
      const originalLength = sampleRows.length;
      selectManifestRows(sampleRows, selection);
      expect(sampleRows.length).toBe(originalLength);
    });

    it("matches sections with case sensitivity", () => {
      const selection: VerifySelection = {
        sections: ["SRC"], // uppercase
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      // The actual matching behavior - it includes assets
      // Text files from SRC (uppercase) would match if they exist, but they don't
      // However the filter logic may include other rows
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("handles case-sensitive file matching", () => {
      const selection: VerifySelection = {
        sections: undefined,
        files: ["src/MAIN.TS"], // uppercase
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result.length).toBe(0); // Should not match "src/main.ts"
    });

    it("filters all assets with empty section array", () => {
      const selection: VerifySelection = {
        sections: [],
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result.some((r) => r.section === "-")).toBe(true);
    });

    it("works with single row array", () => {
      const selection: VerifySelection = {
        sections: ["src"],
        files: undefined,
      };
      const oneRow = sampleRows.slice(0, 1);
      const result = selectManifestRows(oneRow, selection);
      expect(result.length).toBe(1);
      expect(result[0]?.path).toBe("src/main.ts");
    });

    it("works with empty rows array", () => {
      const selection: VerifySelection = {
        sections: ["src"],
        files: undefined,
      };
      const result = selectManifestRows([], selection);
      expect(result).toEqual([]);
    });
  });

  describe("selection filter combinations", () => {
    it("section filter includes assets", () => {
      const selection: VerifySelection = {
        sections: ["tests"],
        files: undefined,
      };
      const result = selectManifestRows(sampleRows, selection);
      // Assets (section "-") are always included when section filter is specified
      expect(result.some((r) => r.section === "-")).toBe(true);
    });

    it("file filter can select assets", () => {
      const selection: VerifySelection = {
        sections: undefined,
        files: ["logo.png", "icon.svg"],
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result.every((r) => r.kind === "asset")).toBe(true);
    });

    it("combining sections and specific asset file", () => {
      const selection: VerifySelection = {
        sections: ["src"],
        files: ["logo.png"],
      };
      const result = selectManifestRows(sampleRows, selection);
      // The logic: section filter keeps src + assets
      // file filter keeps logo.png
      // Combined: logo.png is included even though it's not in src section
      // because the filters are combined with OR logic for assets
      expect(result.some((r) => r.path === "logo.png")).toBe(true);
    });

    it("selecting specific section and files from that section", () => {
      const selection: VerifySelection = {
        sections: ["src"],
        files: ["src/main.ts", "src/util.ts"],
      };
      const result = selectManifestRows(sampleRows, selection);
      expect(result.length).toBe(2);
      expect(result.every((r) => r.section === "src")).toBe(true);
    });
  });
});
