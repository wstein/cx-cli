// test-lane: unit
import { describe, expect, it } from "bun:test";
import type { CxManifest, ManifestFileRow } from "../../src/manifest/types.js";
import {
  selectManifestAssets,
  selectManifestSections,
  summarizeManifest,
} from "../../src/shared/manifestSummary.js";

// Helper to create test manifest
function createTestManifest(): CxManifest {
  return {
    schemaVersion: 6,
    bundleVersion: 1,
    projectName: "test-project",
    sourceRoot: ".",
    bundleDir: "dist",
    checksumFile: "test.sha256",
    createdAt: "2025-01-13T14:30:15Z",
    cxVersion: "1.0.0",
    repomixVersion: "2.0.0",
    checksumAlgorithm: "sha256",
    settings: {
      globalStyle: "xml",
      tokenEncoding: "o200k_base",
      showLineNumbers: false,
      includeEmptyDirectories: false,
      securityCheck: true,
      normalizationPolicy: "repomix-default-v1",
      includeLinkedNotes: false,
    },
    totalTokenCount: 5000,
    vcsProvider: "git",
    dirtyState: "clean",
    modifiedFiles: [],
    trustModel: {
      sourceTree: "trusted",
      notes: "conditional",
      agentOutput: "untrusted_until_verified",
      bundle: "trusted",
    },
    sections: [
      {
        name: "src",
        style: "xml",
        outputFile: "src.xml",
        outputSha256: "h1",
        fileCount: 3,
        tokenCount: 2000,
        files: [],
      },
      {
        name: "docs",
        style: "markdown",
        outputFile: "docs.md",
        outputSha256: "h2",
        fileCount: 2,
        tokenCount: 1500,
        files: [],
      },
      {
        name: "tests",
        style: "xml",
        outputFile: "tests.xml",
        outputSha256: "h3",
        fileCount: 4,
        tokenCount: 1500,
        files: [],
      },
    ],
    assets: [
      {
        sourcePath: "logo.png",
        storedPath: "assets/logo.png",
        sha256: "a1",
        sizeBytes: 1024,
        mtime: "2025-01-13T00:00:00Z",
        mediaType: "image/png",
      },
      {
        sourcePath: "icon.svg",
        storedPath: "assets/icon.svg",
        sha256: "a2",
        sizeBytes: 512,
        mtime: "2025-01-13T00:00:00Z",
        mediaType: "image/svg+xml",
      },
    ],
    files: [
      {
        path: "src/main.ts",
        kind: "text",
        section: "src",
        storedIn: "packed",
        sha256: "f1",
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
        storedIn: "packed",
        sha256: "f2",
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
        storedIn: "packed",
        sha256: "f3",
        sizeBytes: 1024,
        tokenCount: 200,
        mtime: "2025-01-13T00:00:00Z",
        mediaType: "text/markdown",
        outputStartLine: 1,
        outputEndLine: 50,
      },
      {
        path: "logo.png",
        kind: "asset",
        section: "-",
        storedIn: "copied",
        sha256: "a1",
        sizeBytes: 1024,
        tokenCount: 0,
        mtime: "2025-01-13T00:00:00Z",
        mediaType: "image/png",
        outputStartLine: null,
        outputEndLine: null,
      },
    ],
  };
}

describe("manifest summary utilities", () => {
  describe("summarizeManifest", () => {
    it("summarizes manifest with all rows", () => {
      const manifest = createTestManifest();
      const summary = summarizeManifest("test.json", manifest);

      expect(summary.manifestName).toBe("test.json");
      expect(summary.projectName).toBe("test-project");
      expect(summary.fileCount).toBe(manifest.files.length);
    });

    it("counts text files correctly", () => {
      const manifest = createTestManifest();
      const summary = summarizeManifest("test.json", manifest);

      const textCount = manifest.files.filter((f) => f.kind === "text").length;
      expect(summary.textFileCount).toBe(textCount);
    });

    it("counts asset files correctly", () => {
      const manifest = createTestManifest();
      const summary = summarizeManifest("test.json", manifest);

      const assetCount = manifest.files.filter(
        (f) => f.kind === "asset",
      ).length;
      expect(summary.assetFileCount).toBe(assetCount);
    });

    it("counts sections included in rows", () => {
      const manifest = createTestManifest();
      // Select only rows from src and docs sections
      const selectedRows = manifest.files.filter(
        (f) => f.section === "src" || f.section === "docs",
      );
      const summary = summarizeManifestSections(
        "test.json",
        manifest,
        selectedRows,
      );

      expect(summary.sectionCount).toBe(2); // src and docs
    });

    it("counts assets included in rows", () => {
      const manifest = createTestManifest();
      // Select only logo asset
      const selectedRows = manifest.files.filter((f) =>
        f.path === "logo.png" ? true : f.kind === "text",
      );
      const summary = summarizeManifestSections(
        "test.json",
        manifest,
        selectedRows,
      );

      expect(summary.assetCount).toBeLessThanOrEqual(manifest.assets.length);
    });

    it("uses custom rows when provided", () => {
      const manifest = createTestManifest();
      const filteredRows = manifest.files.filter((f) => f.section === "src");
      const summary = summarizeManifest(
        "filtered.json",
        manifest,
        filteredRows,
      );

      expect(summary.fileCount).toBe(filteredRows.length);
    });

    it("preserves manifest name in summary", () => {
      const manifest = createTestManifest();
      const summary = summarizeManifest("custom-name.json", manifest);

      expect(summary.manifestName).toBe("custom-name.json");
    });

    it("preserves project name in summary", () => {
      const manifest = createTestManifest();
      const summary = summarizeManifest("test.json", manifest);

      expect(summary.projectName).toBe(manifest.projectName);
    });

    it("handles empty files array", () => {
      const manifest = createTestManifest();
      manifest.files = [];
      const summary = summarizeManifest("empty.json", manifest);

      expect(summary.fileCount).toBe(0);
      expect(summary.textFileCount).toBe(0);
      expect(summary.assetFileCount).toBe(0);
      expect(summary.sectionCount).toBe(0);
    });

    it("handles empty sections selection", () => {
      const manifest = createTestManifest();
      const summary = summarizeManifest("test.json", manifest, []);

      expect(summary.fileCount).toBe(0);
      expect(summary.sectionCount).toBe(0);
    });

    it("all counts are non-negative", () => {
      const manifest = createTestManifest();
      const summary = summarizeManifest("test.json", manifest);

      expect(summary.fileCount).toBeGreaterThanOrEqual(0);
      expect(summary.textFileCount).toBeGreaterThanOrEqual(0);
      expect(summary.assetFileCount).toBeGreaterThanOrEqual(0);
      expect(summary.sectionCount).toBeGreaterThanOrEqual(0);
      expect(summary.assetCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("selectManifestSections", () => {
    it("selects sections used in rows", () => {
      const manifest = createTestManifest();
      const rowsWithSrcDocs = manifest.files.filter(
        (f) => f.section === "src" || f.section === "docs",
      );
      const selected = selectManifestSections(manifest, rowsWithSrcDocs);

      expect(selected.length).toBe(2);
      expect(selected.map((s) => s.name)).toEqual(
        expect.arrayContaining(["src", "docs"]),
      );
    });

    it("excludes sections not in rows", () => {
      const manifest = createTestManifest();
      const rowsOnlySrc = manifest.files.filter((f) => f.section === "src");
      const selected = selectManifestSections(manifest, rowsOnlySrc);

      expect(selected.length).toBe(1);
      expect(selected[0]?.name).toBe("src");
    });

    it("returns empty array when no rows", () => {
      const manifest = createTestManifest();
      const selected = selectManifestSections(manifest, []);

      expect(selected).toEqual([]);
    });

    it("returns empty array when rows only have assets", () => {
      const manifest = createTestManifest();
      const assetRows = manifest.files.filter((f) => f.kind === "asset");
      const selected = selectManifestSections(manifest, assetRows);

      expect(selected).toEqual([]);
    });

    it("does not duplicate sections", () => {
      const manifest = createTestManifest();
      const selected = selectManifestSections(manifest, manifest.files);

      const sectionNames = selected.map((s) => s.name);
      const uniqueNames = new Set(sectionNames);
      expect(sectionNames.length).toBe(uniqueNames.size);
    });

    it("preserves section properties", () => {
      const manifest = createTestManifest();
      const selected = selectManifestSections(manifest, manifest.files);

      for (const section of selected) {
        expect(section.name).toBeDefined();
        expect(section.style).toBeDefined();
        expect(section.outputFile).toBeDefined();
        expect(section.tokenCount).toBeGreaterThanOrEqual(0);
      }
    });

    it("preserves order from manifest sections", () => {
      const manifest = createTestManifest();
      const selected = selectManifestSections(manifest, manifest.files);

      const originalNames = manifest.sections.map((s) => s.name);
      const selectedNames = selected.map((s) => s.name);

      // Verify each selected section appears in the original order
      let lastIndex = -1;
      for (const name of selectedNames) {
        const currentIndex = originalNames.indexOf(name);
        expect(currentIndex).toBeGreaterThan(lastIndex);
        lastIndex = currentIndex;
      }
    });
  });

  describe("selectManifestAssets", () => {
    it("selects assets used in rows", () => {
      const manifest = createTestManifest();
      const assetRows = manifest.files.filter((f) => f.kind === "asset");
      const selected = selectManifestAssets(manifest, assetRows);

      expect(selected).toEqual(
        expect.arrayContaining(
          manifest.assets.filter((a) =>
            assetRows.some((r) => r.path === a.sourcePath),
          ),
        ),
      );
    });

    it("excludes assets not in rows", () => {
      const manifest = createTestManifest();
      const rows = manifest.files.filter((f) => f.path === "logo.png");
      const selected = selectManifestAssets(manifest, rows);

      expect(selected.length).toBe(1);
      expect(selected[0]?.sourcePath).toBe("logo.png");
    });

    it("returns empty array when no assets in rows", () => {
      const manifest = createTestManifest();
      const textRows = manifest.files.filter((f) => f.kind === "text");
      const selected = selectManifestAssets(manifest, textRows);

      expect(selected).toEqual([]);
    });

    it("returns empty array when no rows", () => {
      const manifest = createTestManifest();
      const selected = selectManifestAssets(manifest, []);

      expect(selected).toEqual([]);
    });

    it("does not duplicate assets", () => {
      const manifest = createTestManifest();
      const selected = selectManifestAssets(manifest, manifest.files);

      const assetPaths = selected.map((a) => a.sourcePath);
      const uniquePaths = new Set(assetPaths);
      expect(assetPaths.length).toBe(uniquePaths.size);
    });

    it("preserves asset properties", () => {
      const manifest = createTestManifest();
      const selected = selectManifestAssets(manifest, manifest.files);

      for (const asset of selected) {
        expect(asset.sourcePath).toBeDefined();
        expect(asset.storedPath).toBeDefined();
        expect(asset.sha256).toBeDefined();
        expect(asset.sizeBytes).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("integration scenarios", () => {
    it("summary matches sections and assets selections", () => {
      const manifest = createTestManifest();
      const summary = summarizeManifest("test.json", manifest);
      const sections = selectManifestSections(manifest, manifest.files);
      const assets = selectManifestAssets(manifest, manifest.files);

      expect(summary.sectionCount).toBe(sections.length);
      expect(summary.assetCount).toBe(assets.length);
    });

    it("filtering by section reduces counts appropriately", () => {
      const manifest = createTestManifest();
      const allSummary = summarizeManifest("all.json", manifest);

      const srcRows = manifest.files.filter((f) => f.section === "src");
      const srcSummary = summarizeManifest("src.json", manifest, srcRows);

      expect(srcSummary.fileCount).toBeLessThanOrEqual(allSummary.fileCount);
      expect(srcSummary.sectionCount).toBeLessThanOrEqual(
        allSummary.sectionCount,
      );
    });

    it("selecting by asset reduces asset count", () => {
      const manifest = createTestManifest();
      const allSummary = summarizeManifest("all.json", manifest);

      const oneAssetRow = manifest.files.filter(
        (f) => f.path === "logo.png" || f.kind === "text",
      );
      const oneSummary = summarizeManifest("one.json", manifest, oneAssetRow);

      expect(oneSummary.assetFileCount).toBeLessThanOrEqual(
        allSummary.assetFileCount,
      );
    });

    it("all selected items exist in manifest", () => {
      const manifest = createTestManifest();
      const sections = selectManifestSections(manifest, manifest.files);
      const assets = selectManifestAssets(manifest, manifest.files);

      for (const section of sections) {
        expect(manifest.sections.some((s) => s.name === section.name)).toBe(
          true,
        );
      }

      for (const asset of assets) {
        expect(
          manifest.assets.some((a) => a.sourcePath === asset.sourcePath),
        ).toBe(true);
      }
    });
  });
});

// Helper function with correct name
function summarizeManifestSections(
  manifestName: string,
  manifest: CxManifest,
  rows: ManifestFileRow[],
) {
  return summarizeManifest(manifestName, manifest, rows);
}
