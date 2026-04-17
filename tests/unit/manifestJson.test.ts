import { describe, expect, it } from "bun:test";
import {
  parseManifestJson,
  renderManifestJson,
} from "../../src/manifest/json.js";
import type { CxManifest } from "../../src/manifest/types.js";

const VALID_MINIMAL_MANIFEST: CxManifest = {
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
  },
  totalTokenCount: 1000,
  vcsProvider: "git",
  dirtyState: "clean",
  modifiedFiles: [],
  sections: [],
  assets: [],
  files: [],
};

describe("manifest JSON parsing and rendering", () => {
  describe("renderManifestJson", () => {
    it("renders minimal manifest to JSON string", () => {
      const json = renderManifestJson(VALID_MINIMAL_MANIFEST);
      expect(typeof json).toBe("string");
      expect(json.length).toBeGreaterThan(0);
      expect(json).toContain("test-project");
    });

    it("produces compact JSON when pretty=false", () => {
      const compact = renderManifestJson(VALID_MINIMAL_MANIFEST, false);
      const pretty = renderManifestJson(VALID_MINIMAL_MANIFEST, true);
      expect(compact.length).toBeLessThanOrEqual(pretty.length);
    });

    it("includes all required manifest fields", () => {
      const json = renderManifestJson(VALID_MINIMAL_MANIFEST);
      expect(json).toContain("schemaVersion");
      expect(json).toContain("projectName");
      expect(json).toContain("sourceRoot");
      expect(json).toContain("settings");
    });

    it("includes optional bundleIndexFile when present", () => {
      const manifestWithIndex = {
        ...VALID_MINIMAL_MANIFEST,
        bundleIndexFile: "index.json",
      };
      const json = renderManifestJson(manifestWithIndex);
      expect(json).toContain("bundleIndexFile");
      expect(json).toContain("index.json");
    });

    it("omits optional bundleIndexFile when absent", () => {
      const json = renderManifestJson(VALID_MINIMAL_MANIFEST);
      // Should not have bundleIndexFile in output
      const parsed = JSON.parse(json);
      expect(parsed.bundleIndexFile).toBeUndefined();
    });

    it("includes notes array when present", () => {
      const manifestWithNotes = {
        ...VALID_MINIMAL_MANIFEST,
        notes: [
          {
            id: "20250113143015",
            title: "Test Note",
            fileName: "test.md",
            aliases: [],
            tags: ["test"],
            summary: "A test note",
            lastModified: "2025-01-13T14:30:15.000Z",
          },
        ],
      };
      const json = renderManifestJson(manifestWithNotes);
      expect(json).toContain("notes");
      expect(json).toContain("Test Note");
    });

    it("produces valid JSON that can be parsed", () => {
      const json = renderManifestJson(VALID_MINIMAL_MANIFEST);
      const parsed = JSON.parse(json);
      expect(parsed).toBeDefined();
      expect(parsed.schemaVersion).toBe(6);
    });

    it("ends with newline", () => {
      const json = renderManifestJson(VALID_MINIMAL_MANIFEST);
      expect(json.endsWith("\n")).toBe(true);
    });

    it("preserves all manifest properties", () => {
      const manifest: CxManifest = {
        ...VALID_MINIMAL_MANIFEST,
        totalTokenCount: 5000,
        projectName: "my-special-project",
      };
      const json = renderManifestJson(manifest);
      const parsed = JSON.parse(json);
      expect(parsed.totalTokenCount).toBe(5000);
      expect(parsed.projectName).toBe("my-special-project");
    });

    it("handles manifest with sections", () => {
      const manifestWithSections: CxManifest = {
        ...VALID_MINIMAL_MANIFEST,
        sections: [
          {
            name: "src",
            style: "xml",
            outputFile: "src.xml.txt",
            outputSha256: "abc123",
            fileCount: 5,
            tokenCount: 1000,
            files: [
              {
                path: "src/main.ts",
                kind: "text",
                section: "src",
                storedIn: "packed",
                sha256: "def456",
                sizeBytes: 1024,
                tokenCount: 100,
                mediaType: "text/plain",
                outputStartLine: 1,
                outputEndLine: 50,
              },
            ],
          },
        ],
      };
      const json = renderManifestJson(manifestWithSections);
      expect(json).toContain("src");
      expect(json).toContain("src/main.ts");
    });

    it("handles manifest with assets", () => {
      const manifestWithAssets: CxManifest = {
        ...VALID_MINIMAL_MANIFEST,
        assets: [
          {
            sourcePath: "images/logo.png",
            storedPath: "assets/logo.png",
            sha256: "ghi789",
            sizeBytes: 2048,
            mediaType: "image/png",
          },
        ],
      };
      const json = renderManifestJson(manifestWithAssets);
      expect(json).toContain("images/logo.png");
    });
  });

  describe("parseManifestJson", () => {
    it("parses valid minimal manifest JSON", () => {
      const json = renderManifestJson(VALID_MINIMAL_MANIFEST);
      const parsed = parseManifestJson(json);
      expect(parsed.projectName).toBe(VALID_MINIMAL_MANIFEST.projectName);
      expect(parsed.schemaVersion).toBe(6);
    });

    it("throws error for invalid JSON", () => {
      expect(() => {
        parseManifestJson("not valid json {");
      }).toThrow();
    });

    it("throws error for wrong schema version", () => {
      const json = JSON.stringify({
        ...JSON.parse(renderManifestJson(VALID_MINIMAL_MANIFEST)),
        schemaVersion: 5,
      });
      expect(() => {
        parseManifestJson(json);
      }).toThrow();
    });

    it("throws error for missing schemaVersion", () => {
      const json = JSON.stringify({
        projectName: "test",
        bundleVersion: 1,
      });
      expect(() => {
        parseManifestJson(json);
      }).toThrow();
    });

    it("throws error for missing projectName", () => {
      const json = JSON.stringify({
        ...JSON.parse(renderManifestJson(VALID_MINIMAL_MANIFEST)),
        projectName: undefined,
      });
      expect(() => {
        parseManifestJson(json);
      }).toThrow();
    });

    it("throws error for non-string projectName", () => {
      const json = JSON.stringify({
        ...JSON.parse(renderManifestJson(VALID_MINIMAL_MANIFEST)),
        projectName: 123,
      });
      expect(() => {
        parseManifestJson(json);
      }).toThrow();
    });

    it("preserves all manifest fields except bundleVersion", () => {
      const original: CxManifest = {
        ...VALID_MINIMAL_MANIFEST,
        bundleVersion: 1,
        sourceRoot: "/project",
        totalTokenCount: 12345,
      };
      const json = renderManifestJson(original);
      const parsed = parseManifestJson(json);
      // Note: parseManifestJson always sets bundleVersion to 1
      expect(parsed.bundleVersion).toBe(1);
      expect(parsed.sourceRoot).toBe("/project");
      expect(parsed.totalTokenCount).toBe(12345);
    });

    it("parses manifest with sections", () => {
      const json = renderManifestJson({
        ...VALID_MINIMAL_MANIFEST,
        sections: [
          {
            name: "src",
            style: "xml",
            outputFile: "src.xml",
            outputSha256: "hash123",
            fileCount: 1,
            tokenCount: 500,
            files: [
              {
                path: "src/main.ts",
                kind: "text",
                section: "src",
                storedIn: "packed",
                sha256: "fhash",
                sizeBytes: 512,
                tokenCount: 50,
                mtime: "2025-01-13T00:00:00Z",
                mediaType: "text/plain",
                outputStartLine: 1,
                outputEndLine: 20,
              },
            ],
          },
        ],
      });
      const parsed = parseManifestJson(json);
      expect(parsed.sections.length).toBe(1);
      expect(parsed.sections[0]?.name).toBe("src");
      expect(parsed.sections[0]?.fileCount).toBe(1);
    });

    it("parses manifest with assets", () => {
      const json = renderManifestJson({
        ...VALID_MINIMAL_MANIFEST,
        assets: [
          {
            sourcePath: "logo.png",
            storedPath: "assets/logo.png",
            sha256: "ahash",
            sizeBytes: 4096,
            mtime: "2025-01-13T00:00:00Z",
            mediaType: "image/png",
          },
        ],
      });
      const parsed = parseManifestJson(json);
      expect(parsed.assets.length).toBe(1);
      expect(parsed.assets[0]?.sourcePath).toBe("logo.png");
    });

    it("parses manifest with notes", () => {
      const json = renderManifestJson({
        ...VALID_MINIMAL_MANIFEST,
        notes: [
          {
            id: "20250113143015",
            title: "My Note",
            fileName: "note.md",
            aliases: ["alias1"],
            tags: ["tag1", "tag2"],
            summary: "A short summary",
            lastModified: "2025-01-13T14:30:15.000Z",
          },
        ],
      });
      const parsed = parseManifestJson(json);
      expect(parsed.notes).toBeDefined();
      expect(parsed.notes?.length).toBe(1);
      expect(parsed.notes?.[0]?.title).toBe("My Note");
    });

    it("throws error for invalid notes array", () => {
      const json = JSON.stringify({
        ...JSON.parse(renderManifestJson(VALID_MINIMAL_MANIFEST)),
        notes: "not-an-array",
      });
      expect(() => {
        parseManifestJson(json);
      }).toThrow();
    });

    it("validates settings.globalStyle", () => {
      const invalidJson = JSON.stringify({
        ...JSON.parse(renderManifestJson(VALID_MINIMAL_MANIFEST)),
        settings: {
          ...JSON.parse(renderManifestJson(VALID_MINIMAL_MANIFEST)).settings,
          globalStyle: 123,
        },
      });
      expect(() => {
        parseManifestJson(invalidJson);
      }).toThrow();
    });

    it("defaults modifiedFiles to empty array when absent", () => {
      const json = JSON.stringify({
        ...JSON.parse(renderManifestJson(VALID_MINIMAL_MANIFEST)),
        modifiedFiles: undefined,
      });
      const parsed = parseManifestJson(json);
      expect(Array.isArray(parsed.modifiedFiles)).toBe(true);
      expect(parsed.modifiedFiles.length).toBe(0);
    });

    it("produces files array combining sections and assets", () => {
      const json = renderManifestJson({
        ...VALID_MINIMAL_MANIFEST,
        sections: [
          {
            name: "src",
            style: "xml",
            outputFile: "src.xml",
            outputSha256: "sh1",
            fileCount: 1,
            tokenCount: 100,
            files: [
              {
                path: "src/index.ts",
                kind: "text",
                section: "src",
                storedIn: "packed",
                sha256: "sh2",
                sizeBytes: 512,
                tokenCount: 50,
                mtime: "2025-01-13T00:00:00Z",
                mediaType: "text/plain",
                outputStartLine: 1,
                outputEndLine: 10,
              },
            ],
          },
        ],
        assets: [
          {
            sourcePath: "img.png",
            storedPath: "assets/img.png",
            sha256: "sh3",
            sizeBytes: 1024,
            mtime: "2025-01-13T00:00:00Z",
            mediaType: "image/png",
          },
        ],
      });
      const parsed = parseManifestJson(json);
      expect(parsed.files.length).toBe(2);
      const assetFile = parsed.files.find((f) => f.kind === "asset");
      expect(assetFile).toBeDefined();
    });

    it("sorts files array by path", () => {
      const json = renderManifestJson({
        ...VALID_MINIMAL_MANIFEST,
        sections: [
          {
            name: "src",
            style: "xml",
            outputFile: "src.xml",
            outputSha256: "sh1",
            fileCount: 2,
            tokenCount: 200,
            files: [
              {
                path: "z.ts",
                kind: "text",
                section: "src",
                storedIn: "packed",
                sha256: "sh2",
                sizeBytes: 256,
                tokenCount: 50,
                mtime: "2025-01-13T00:00:00Z",
                mediaType: "text/plain",
                outputStartLine: 1,
                outputEndLine: 10,
              },
              {
                path: "a.ts",
                kind: "text",
                section: "src",
                storedIn: "packed",
                sha256: "sh3",
                sizeBytes: 256,
                tokenCount: 50,
                mtime: "2025-01-13T00:00:00Z",
                mediaType: "text/plain",
                outputStartLine: 11,
                outputEndLine: 20,
              },
            ],
          },
        ],
      });
      const parsed = parseManifestJson(json);
      expect(parsed.files[0]?.path).toBe("a.ts");
      expect(parsed.files[1]?.path).toBe("z.ts");
    });

    it("preserves bundleIndexFile when present", () => {
      const json = renderManifestJson({
        ...VALID_MINIMAL_MANIFEST,
        bundleIndexFile: "index.json",
      });
      const parsed = parseManifestJson(json);
      expect(parsed.bundleIndexFile).toBe("index.json");
    });

    it("omits bundleIndexFile when absent", () => {
      const json = renderManifestJson(VALID_MINIMAL_MANIFEST);
      const parsed = parseManifestJson(json);
      expect(parsed.bundleIndexFile).toBeUndefined();
    });
  });

  describe("round-trip consistency", () => {
    it("manifest survives render-parse-render cycle", () => {
      const json1 = renderManifestJson(VALID_MINIMAL_MANIFEST);
      const parsed = parseManifestJson(json1);
      const json2 = renderManifestJson(parsed);
      const parsed2 = parseManifestJson(json2);
      expect(parsed2.projectName).toBe(VALID_MINIMAL_MANIFEST.projectName);
    });

    it("complex manifest survives round-trip", () => {
      const complex: CxManifest = {
        ...VALID_MINIMAL_MANIFEST,
        sections: [
          {
            name: "docs",
            style: "markdown",
            outputFile: "docs.md",
            outputSha256: "dh1",
            fileCount: 2,
            tokenCount: 500,
            files: [
              {
                path: "README.md",
                kind: "text",
                section: "docs",
                storedIn: "packed",
                sha256: "dh2",
                sizeBytes: 1024,
                tokenCount: 200,
                mtime: "2025-01-13T00:00:00Z",
                mediaType: "text/markdown",
                outputStartLine: 1,
                outputEndLine: 50,
              },
            ],
          },
        ],
        assets: [
          {
            sourcePath: "icon.svg",
            storedPath: "assets/icon.svg",
            sha256: "dh3",
            sizeBytes: 512,
            mtime: "2025-01-13T00:00:00Z",
            mediaType: "image/svg+xml",
          },
        ],
        notes: [
          {
            id: "20250113143015",
            title: "Design Note",
            fileName: "design.md",
            aliases: ["arch", "design-doc"],
            tags: ["architecture", "design"],
            summary: "Architecture decisions",
            lastModified: "2025-01-13T14:30:15.000Z",
          },
        ],
      };
      const json1 = renderManifestJson(complex);
      const parsed = parseManifestJson(json1);
      const json2 = renderManifestJson(parsed);
      expect(json1).toContain("Design Note");
      expect(json2).toContain("Design Note");
    });
  });
});
